"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, QrCode } from "lucide-react";
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
import { parentIdOf, visitAddonShort, visitShort } from "@/lib/visit-groups";
import { verifyVisitOtp } from "@/actions/appointments/visit-otp";
import { SendVisitOtpButton, visitCodeStatus } from "@/components/send-visit-otp";
import { AssignTherapistCard } from "./assign-therapist-card";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { PaymentQrDialog } from "@/components/payment-qr-dialog";
import { formatINR } from "@/components/pages/services/services-columns";
import { format } from "date-fns";
import { firstBookableDay } from "@/lib/booking-conflicts";

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

type SessionRecord = NonNullable<slotBookingZodType["sessionNotes"]>[number];

/**
 * What was recorded for a completed visit. Completing clears the checklist
 * and note for the next visit (the note is filed in History), so the empty
 * boxes said nothing about what happened; this reads the filed record.
 */
function RecordedVisit({ entry }: { entry?: SessionRecord }) {
  const when = (iso?: string) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : "");
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2.5 text-[13px]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What was recorded</p>
      {entry?.verifiedAt && <p>Code verified {when(entry.verifiedAt)}</p>}
      {entry?.performed !== undefined && (
        <p>Service performed: {entry.performed ? "Yes" : "Not ticked"}</p>
      )}
      <p className="whitespace-pre-wrap">
        Note: {entry?.note?.trim() ? entry.note : <span className="text-muted-foreground">none written</span>}
      </p>
      {entry?.at && (
        <p className="text-[11px] text-muted-foreground">
          Completed {when(entry.at)}{entry.by ? ` by ${entry.by}` : ""}
        </p>
      )}
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
  const [verified, setVerified] = useState(!!appointment.visitOtpVerified);
  // Uber-style "show the QR" popup for collecting at the door.
  const [payQrOpen, setPayQrOpen] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");

  useEffect(() => {
    setDraft(appointment);
    // Don't preload the executive's booking note - therapist writes fresh each session.
    // The backend snapshots note into sessionNotes on completion and clears it.
    setNote("");
    setVerified(!!appointment.visitOtpVerified);
    setOtp("");
  }, [appointment._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = new Set(draft.workChecklist ?? []);
  const actor =
    `${user?.userfName ?? ""} ${user?.userlName ?? ""}`.trim() || "Someone";
  // A therapist finishes once the work is recorded (the server refuses it too).
  const workRecorded = done.has("performed") && note.trim().length > 0;
  const progress = getPackageProgressForAppointment(draft, [draft], services);
  const isMulti = !!progress;
  const packageDone = !!progress && progress.completed >= progress.total;

  // This visit's own payment, paced per session - the single source of truth that
  // mirrors the backend (visitShort / visitAddonShort). Payment is the last gate
  // before a visit closes (not a precondition for starting). On a multi-session
  // package this is ONE session's share, never the whole package price. The
  // booking share is collected here; same-visit add-ons settle on Billing, but the
  // server blocks completion until both are clear, so both gate this step.
  const parentId = parentIdOf(appointment);
  const moneyParent =
    (parentId ? allAppointments.find((r) => r._id === parentId) : undefined) ?? appointment;
  const bookingDue = visitShort(appointment, moneyParent);
  const addonDue = visitAddonShort(appointment).amount;
  const paymentCleared = bookingDue + addonDue <= 0;

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

    // Payment is the last gate before a visit closes: the therapist can start,
    // work and note freely, but completing needs this visit's payment cleared.
    if (!paymentCleared) {
      toast.error("Collect this visit's payment before completing.");
      return;
    }

    // Both single visits and courses count through the atomic complete-session
    // endpoint, which snapshots the therapist's note into sessionNotes.
    if (appointment._id) {
      markSessionComplete(
        {
          appointmentId: appointment._id,
          note: note.trim() || undefined,
          performed: done.has("performed"),
        },
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
    <div className="space-y-4 rounded-lg border p-3">
      {packageDone && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/50 px-2.5 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          All {progress?.total} sessions are done. Nothing left to record.
        </p>
      )}

      {draft.status === "completed" ? (
        <RecordedVisit entry={draft.sessionNotes?.at(-1)} />
      ) : (
      <>
      <Step
        n={1}
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
          <p className="mb-1 text-[11px] text-muted-foreground">{visitCodeStatus(draft)}</p>
        )}
        {verified ? (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            Verified by the customer - the session is under way.
          </p>
        ) : (
          // The office sends, the therapist verifies - never the same person,
          // so a session can't start without the customer (enforced server-side).
          <div className="flex gap-1.5">
            <SendVisitOtpButton
              appointment={appointment}
              onSent={() =>
                setDraft((d) => ({
                  ...d,
                  visitOtpSentAt: new Date().toISOString(),
                  visitOtpSentBy: actor,
                  visitOtpVerifiedAt: undefined,
                }))
              }
            />
            {isTherapist && (
              <>
                <Input
                  value={otp}
                  // Codes are 4 digits: digits only, number keypad on phones.
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
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

      <Step
        n={4}
        title="Payment"
        sub={
          paymentCleared
            ? undefined
            : isTherapist
              ? "Collect this visit's payment to finish. The customer can scan the QR, or record what they paid."
              : "This visit's payment must be cleared before it can be completed."
        }
      >
        {paymentCleared ? (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            Payment cleared - you can complete the visit.
          </p>
        ) : (
          <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
            <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
              {bookingDue > 0 && <>{formatINR(bookingDue)} due for this session before completing.</>}
              {addonDue > 0 && (
                <>
                  {bookingDue > 0 ? " " : ""}
                  {formatINR(addonDue)} in add-ons is settled on the Billing tab.
                </>
              )}
            </p>
            {bookingDue > 0 && appointment._id && (
              <RecordPaymentForm
                appointmentId={appointment._id}
                due={bookingDue}
                suggested={bookingDue}
                companyPayee
              />
            )}
            {/* One way to actually collect: a quick QR popup the customer scans
                with any UPI app - it pays the company, amount baked in. */}
            {bookingDue > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 pt-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5"
                  onClick={() => setPayQrOpen(true)}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Show payment QR
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Customer scans to pay the company - amount is baked in.
                </span>
              </div>
            )}
            <PaymentQrDialog
              open={payQrOpen}
              onOpenChange={setPayQrOpen}
              amount={bookingDue}
              reference={appointment.enquiryId}
            />
          </div>
        )}
      </Step>
      </>
      )}

      <Step n={5} title="Finish">
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
          <>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={isCompleting || packageDone || !verified || !paymentCleared || (isTherapist && !workRecorded)}
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
          {isTherapist && verified && (!workRecorded || !paymentCleared) && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {!paymentCleared
                ? bookingDue > 0
                  ? `Collect ${formatINR(bookingDue)} to finish.`
                  : `Settle ${formatINR(addonDue)} in add-ons on Billing to finish.`
                : done.has("performed")
                  ? "Write the session note to finish."
                  : note.trim()
                    ? "Tick Service performed to finish."
                    : "Tick Service performed and write the session note to finish."}
            </p>
          )}
          </>
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
      {/* Not on a course with a visit per session: the next one has its own. */}
      {isMulti && !packageDone && !isTherapist && !progress?.split && (
        <Step n={6} title="Next visit" sub="Optional - book it while you are here.">
          <div className="flex gap-1.5">
            <Input
              type="date"
              className="h-8"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              min={firstBookableDay()}
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
