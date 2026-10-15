"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCompleteSession,
  useUpdateAppointment,
} from "@/data/appointment/appointment";
import { useGetServices } from "@/data/service/service";
import { useAuthStore } from "@/providers/permission-provider";
import type { ActivityEntry, slotBookingZodType } from "@/type/schema";
import { getPackageProgressForAppointment } from "@/lib/package-progress";
import { whatsAppLink } from "@/lib/whatsapp";
import { sendVisitOtp, verifyVisitOtp } from "@/actions/appointments/visit-otp";
import { AssignTherapistCard } from "./assign-therapist-card";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { formatINR } from "@/components/pages/services/services-columns";

function Step({
  n,
  done,
  title,
  sub,
  children,
}: {
  n: number | "check";
  done?: boolean;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          done
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-primary/10 text-primary"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[13px] font-semibold leading-tight">{title}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * The therapist's half of the panel, in the order the visit actually happens:
 * mark arrival, verify you are with the customer, write the note, complete.
 *
 * This used to be the last thing on a long scroll, below the money and the
 * booking terms - the person with one hand free had the most to scroll past.
 */
export function VisitTab({
  appointment,
  allAppointments,
}: {
  appointment: slotBookingZodType;
  allAppointments: slotBookingZodType[];
}) {
  const { user } = useAuthStore();
  const isTherapist = user?.role === "THERAPIST";
  const canSendVisitOtp = ["SUPER_ADMIN", "ADMIN", "STAFF"].includes(user?.role ?? "");
  // The visit itself is the therapist's work; an admin may only complete it
  // for them, after a warning (the backend allows the same three roles).
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const [confirmAdminComplete, setConfirmAdminComplete] = useState(false);
  const { data: services = [] } = useGetServices();
  const { mutate: update } = useUpdateAppointment({ silent: true });
  const { mutate: saveNote } = useUpdateAppointment({ silent: true });
  const { mutate: markSessionComplete, isPending: isCompleting } =
    useCompleteSession();

  const [draft, setDraft] = useState<slotBookingZodType>(appointment);
  const [note, setNote] = useState("");
  const [otp, setOtp] = useState("");
  // Cash still to collect before this session can start (from Verify).
  const [short, setShort] = useState(0);
  const [owed, setOwed] = useState(0);
  const [verified, setVerified] = useState(!!appointment.visitOtpVerified);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");

  useEffect(() => {
    setDraft(appointment);
    // Don't preload the executive's booking note - therapist writes fresh each session.
    // The backend snapshots note into sessionNotes on completion and clears it.
    setNote("");
    setVerified(!!appointment.visitOtpVerified);
    setOtp("");
    setShort(0);
  }, [appointment._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = new Set(draft.workChecklist ?? []);
  const actor =
    `${user?.userfName ?? ""} ${user?.userlName ?? ""}`.trim() || "Someone";
  const progress = getPackageProgressForAppointment(draft, [draft], services);
  const isMulti = !!progress;
  const packageDone = !!progress && progress.completed >= progress.total;

  function toggle(key: string, label: string, checked: boolean) {
    const next = new Set(done);
    if (checked) next.add(key);
    else next.delete(key);

    const entry: ActivityEntry = {
      at: new Date().toISOString(),
      userId: user?.id,
      name: actor,
      action: `${checked ? "Checked" : "Unchecked"}: ${label}`,
    };
    const patch: slotBookingZodType = {
      ...draft,
      workChecklist: [...next],
      activityLog: [...(draft.activityLog ?? []), entry],
    };
    if (key === "arrived" && checked) patch.status = "ongoing";
    setDraft(patch);
    update(patch);
  }

  // Verifying the code IS the start of the session: the customer has confirmed
  // the therapist is in front of them, which is exactly what "arrived" claims.
  function startSession() {
    const next = new Set(done).add("arrived");
    const patch: slotBookingZodType = {
      ...draft,
      status: "ongoing",
      workChecklist: [...next],
      activityLog: [
        ...(draft.activityLog ?? []),
        {
          at: new Date().toISOString(),
          userId: user?.id,
          name: actor,
          action: "Session started - verified by the customer",
        },
      ],
    };
    setDraft(patch);
    update(patch);
  }

  function complete() {
    if (!verified) {
      toast.error("Start the session first - the customer has to verify the code.");
      return;
    }
    if (packageDone) return;

    // No payment check here: each session is paid for before it starts
    // (the code can't be verified until it is).

    // Both single visits and courses count through the atomic complete-session
    // endpoint, which snapshots the therapist's note into sessionNotes.
    if (appointment._id) {
      markSessionComplete(
        { appointmentId: appointment._id, note: note.trim() || undefined },
        {
          onSuccess: (result) => {
            if (result.data) setDraft(result.data as slotBookingZodType);
            setVerified(false); // consumed - the next visit needs a fresh code
            setNote(""); // clear the textarea for next visit
            toast.success(
              isMulti
                ? `Session ${progress?.currentSession ?? ""} of ${progress?.total ?? ""} completed!`
                : "Visit completed successfully!",
            );
          },
        },
      );
    }
  }

  const label = progress
    ? `Complete session ${progress.currentSession} of ${progress.total}`
    : "Complete this visit";

  return (
    <div className="space-y-3">
      {/* Always present: who is doing the visit, and a way to change them. */}
      <AssignTherapistCard
        appointment={appointment}
        allAppointments={allAppointments}
        isCompleted={draft.status === "completed"}
      />

      {/* There is no visit to run until someone is assigned to it. */}
      {!appointment.doctorId ? null : (
    <div className={`space-y-4 rounded-lg border p-3 ${draft.status === "completed" ? "opacity-50 pointer-events-none" : ""}`}>
      {packageDone && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/50 px-2.5 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          All {progress?.total} sessions are done. Nothing left to record.
        </p>
      )}

      <Step
        n={1}
        done={verified}
        title="Start the session"
        sub={
          verified
            ? undefined
            : isTherapist
              ? "Ask the office to send the customer a code, then type what they read out. The session starts once it checks out."
              : "Send the customer a code. The therapist types what the customer reads out to start the session."
        }
      >
        {draft.visitOtpSentAt && (
          <p className="mb-1 text-[11px] text-muted-foreground">
            Code sent {format(new Date(draft.visitOtpSentAt), "yyyy-MM-dd HH:mm")}
            {draft.visitOtpSentBy ? ` by ${draft.visitOtpSentBy}` : ""}
            {draft.visitOtpVerifiedAt
              ? ` · verified ${format(new Date(draft.visitOtpVerifiedAt), "yyyy-MM-dd HH:mm")}`
              : " · works until it's used"}
          </p>
        )}
        {verified ? (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            Verified by the customer - the session is under way.
          </p>
        ) : (
          // The office sends, the therapist verifies - never the same person,
          // so a session can't start without the customer (enforced server-side).
          <div className="flex gap-1.5">
            {canSendVisitOtp && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={async () => {
                  if (!appointment._id) return;
                  const r = await sendVisitOtp(appointment._id);
                  if (!r.success || !r.code) {
                    toast.error(r.message ?? "Could not create a code");
                    return;
                  }
                  const link = whatsAppLink(
                    appointment.phonenumber,
                    `Your MDW visit code is ${r.code}`,
                  );
                  setDraft((d) => ({
                    ...d,
                    visitOtpSentAt: new Date().toISOString(),
                    visitOtpSentBy: actor,
                    visitOtpVerifiedAt: undefined,
                  }));
                  if (link) window.open(link, "_blank");
                  else toast.error("Customer number can't be messaged on WhatsApp");
                }}
              >
                Send OTP
              </Button>
            )}
            {isTherapist && (
              <>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Code"
                  className="h-8"
                  aria-label="Code from the customer"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={!otp.trim()}
                  onClick={async () => {
                    if (!appointment._id) return;
                    const r = await verifyVisitOtp(appointment._id, otp.trim());
                    if (r.success) {
                      setVerified(true);
                      setDraft((d) => ({ ...d, visitOtpVerifiedAt: new Date().toISOString() }));
                      setOtp("");
                      // The customer just confirmed the therapist is with them, so
                      // arrival is proven - no need to also tick it by hand.
                      startSession();
                      toast.success("Session started");
                    } else if (r.short) {
                      // Today's session isn't paid for: collect, then verify again.
                      setShort(r.short);
                      setOwed(Math.max(r.short, r.due ?? 0));
                    } else {
                      toast.error(r.message ?? "Incorrect code");
                    }
                  }}
                >
                  Verify
                </Button>
              </>
            )}
          </div>
        )}
        {isTherapist && !verified && short > 0 && appointment._id && (
          <div className="mt-2 space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
            <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
              Collect at least {formatINR(short)} before starting this session
              {owed > short ? ` (${formatINR(owed)} is due in total)` : ""}. Record what
              the customer paid, then verify the code again.
            </p>
            <RecordPaymentForm
              appointmentId={appointment._id}
              due={owed}
              suggested={short}
              onRecorded={() => setShort(0)}
            />
          </div>
        )}
      </Step>

      <Step n={2} title="During the visit">
        {isTherapist ? (
          <label className="flex w-fit cursor-pointer items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              disabled={!verified}
              checked={done.has("performed")}
              onChange={(e) =>
                toggle("performed", "Service performed", e.target.checked)
              }
            />
            Service performed
          </label>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Service performed: {done.has("performed") ? "Done" : "Not yet"}
          </p>
        )}
      </Step>

      <Step
        n={3}
        title={
          progress
            ? `Session note - session ${progress.currentSession} of ${progress.total}`
            : "Session note"
        }
        sub={
          isTherapist
            ? `Findings, diagnosis, what you did. Saved automatically, filed under ${actor}.`
            : "Written by the therapist. Past session notes are in History."
        }
      >
        {isTherapist && (
        <Textarea
          rows={4}
          value={note}
          disabled={!verified}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            // Save whenever there's content to persist (prevents loss on tab switch)
            if (note.trim()) {
              saveNote({ ...draft, note });
            }
          }}
          placeholder="Lower back, limited flexion. Dry needling on QL, 15 min stretch..."
        />
        )}
      </Step>

      <Step n={4} title="Finish">
        {draft.status === "completed" ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              {isMulti
                ? `Session ${progress?.currentSession ?? ""} of ${progress?.total ?? ""} completed`
                : "Visit completed"}
            </span>
          </div>
        ) : !isTherapist && !isAdmin ? (
          <p className="text-[13px] text-muted-foreground">
            The therapist completes the visit.
          </p>
        ) : (
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={isCompleting || packageDone || !verified}
            onClick={() => (isTherapist ? complete() : setConfirmAdminComplete(true))}
          >
            {isCompleting ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              label
            )}
          </Button>
        )}
      </Step>

      <AlertDialog open={confirmAdminComplete} onOpenChange={setConfirmAdminComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this visit for the therapist?</AlertDialogTitle>
            <AlertDialogDescription>
              Completing the visit is the therapist&apos;s job. Only do this if
              they can&apos;t, for example they forgot before leaving. It will be
              recorded in History as completed by you on their behalf, and the
              session note box is cleared for the next visit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={complete}
            >
              Complete anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rolling scheduling: the next visit is booked at the end of this one,
          which is how treatment courses actually run. Optional - completing a
          session never depends on it. Only admins/staff can schedule. */}
      {isMulti && !packageDone && !isTherapist && (
        <Step n={5} title="Next visit" sub="Optional - book it while you are here.">
          <div className="flex gap-1.5">
            <Input
              type="date"
              className="h-8"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              aria-label="Next visit date"
            />
            <Input
              type="time"
              className="h-8"
              value={nextTime}
              onChange={(e) => setNextTime(e.target.value)}
              aria-label="Next visit time"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              disabled={!nextDate || !nextTime}
              onClick={() => {
                const patch: slotBookingZodType = {
                  ...draft,
                  slot: { date: nextDate, time: nextTime },
                  status: "scheduled",
                };
                setDraft(patch);
                update(patch);
                setNextDate("");
                setNextTime("");
                toast.success("Next visit scheduled");
              }}
            >
              Set
            </Button>
          </div>
        </Step>
      )}
    </div>
      )}
    </div>
  );
}
