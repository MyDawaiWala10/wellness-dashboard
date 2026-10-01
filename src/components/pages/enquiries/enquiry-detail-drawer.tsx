"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfToday } from "date-fns";
import {
  CalendarIcon,
  Check,
  Loader2,
  Pencil,
  PhoneMissed,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toPhoneDigits } from "@/lib/phone";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn, tidyActivityText } from "@/lib/utils";
import { RecordIds } from "@/components/pages/appointment/record-ids";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { BookingSourceEditor } from "@/components/booking-source-editor";
import { formatTimeRange } from "./time-range";

import {
  useDeleteAppointment,
  useGetAllAppointments,
  useUpdateAppointment,
} from "@/data/appointment/appointment";
import { useGetClinicSettings } from "@/data/clinic-settings/clinic-settings";
import {
  checkConflict,
  toMinutes,
  type ConflictResult,
} from "@/lib/booking-conflicts";
import createPaymentLink from "@/actions/appointments/create-payment-link";
import { useGetServices } from "@/data/service/service";
import { useGetBackOfficeUsers } from "@/data/user/user-list";
import { useAuthStore } from "@/providers/permission-provider";
import { formatINR } from "@/components/pages/services/services-columns";
import { BRAND, publicOrigin } from "@/lib/brand";
import { toWhatsAppNumber, whatsAppLink } from "@/lib/whatsapp";
import {
  paymentRequestMessage,
  paymentConfirmedMessage,
} from "@/lib/payment-messages";
import type { ActivityEntry, EnquiryType } from "@/type/schema";
import { EnquiryStatusBadge } from "./enquiry-status-badge";
import { EnquiryProgressStepper } from "./enquiry-progress-stepper";
import {
  BOOKING_TYPES,
  bookingTypeLabel,
  bookingTypeFromService,
  catalogueFee,
  toDayKey,
  type BookingType,
} from "./booking";
import { TherapistAvailabilityGrid } from "./therapist-availability-grid";

const STATUS_LABELS: Record<string, string> = {
  enquiry: "Enquiry",
  scheduled: "Scheduled",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Reason options when reassigning an already-assigned therapist (T4).
const REASSIGN_REASONS = [
  "Therapist unavailable / on leave",
  "Customer requested a different therapist",
  "Gender preference",
  "Load / schedule balancing",
  "Other",
];

interface EnquiryDetailDrawerProps {
  record: EnquiryType | null;
  onClose: () => void;
}

export function EnquiryDetailDrawer({
  record,
  onClose,
}: EnquiryDetailDrawerProps) {
  const open = record !== null;
  // Auto-save is silent (inline indicator), so suppress the per-save toast.
  const { mutate: update, isPending: isUpdating } = useUpdateAppointment({
    silent: true,
  });
  const { mutate: del, isPending: isDeleting } = useDeleteAppointment();
  const { data: users } = useGetBackOfficeUsers();
  const { data: services = [] } = useGetServices();

  // Local edit buffer keeps the form responsive without writing every keystroke.
  // Re-syncs to the latest record prop whenever the parent re-renders with
  // fresh data (e.g. after a server update). Unsaved local edits are lost on
  // re-sync - acceptable for MVP because saves happen on every blur and toggle.
  const [draft, setDraft] = useState<EnquiryType | null>(record);

  // ── All remaining hooks MUST be declared above the early return so the
  //    hook order is identical every render. (React's rules-of-hooks.)
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

  // Conflict-check inputs (T8/T9): the clinic's booking gap plus the full
  // appointment list, so confirming an assignment can be checked over the full
  // candidate span against every other visit that therapist has that day.
  const { data: clinicSettings } = useGetClinicSettings();
  const gapMinutes = clinicSettings?.bookingGapMinutes ?? 60;
  const { data: appointments = [] } = useGetAllAppointments({
    id: currentUser?.id,
    role: currentUser?.role,
    userEmail: currentUser?.userEmail,
  });

  // Permission gate: only admins or the original reachedOutBy person can
  // edit the lead's status. Everyone else sees status as read-only.
  const canEditStatus = useMemo(() => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    return draft?.reachedOutBy?.userId === currentUser.id;
  }, [currentUser, isAdmin, draft?.reachedOutBy?.userId]);

  // Broader edit gate (T3/T5): admins, the owner, or anyone while the lead is
  // still unclaimed. A non-owner exec must supply a reason (captured below).
  const canEdit = useMemo(() => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    const owner = draft?.reachedOutBy?.userId;
    return !owner || owner === currentUser.id;
  }, [currentUser, isAdmin, draft?.reachedOutBy?.userId]);
  const ownerName = draft?.reachedOutBy?.name ?? "another executive";

  // Editable inline state for the admin reachedOutBy override.
  const [editingReachedBy, setEditingReachedBy] = useState(false);
  // Lead info is what the customer already told us - read-only by default.
  // Editing is deliberate: a phone typo silently splits one customer in two.
  const [editingLead, setEditingLead] = useState(false);

  // Delete confirmation modal open state. Lifted to React state (instead of
  // Radix AlertDialogTrigger) so the dialog can be rendered OUTSIDE the Sheet -
  // nesting a Radix AlertDialog inside a Sheet causes the Sheet's pointer-events
  // overlay to swallow the trigger's first click, forcing the user to double-tap.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Inline save feedback (replaces per-save toasts). `savedOnce` gates the
  // "All changes saved" label so it doesn't show before any edit happens.
  const [savedOnce, setSavedOnce] = useState(false);

  // Minting the pay link is a server round-trip - don't let it be double-fired.
  const [requestingPayment, setRequestingPayment] = useState(false);

  // Status-override flow: picking a new status stages it here and reveals a
  // required reason note; nothing is written until the note is filled + applied.
  const [pendingStatus, setPendingStatus] =
    useState<EnquiryType["status"] | null>(null);
  const [overrideNote, setOverrideNote] = useState("");

  // ── Executive-lock (T3/T4/T5) local state ──
  // Once a non-owner supplies an override reason, it rides along with saves for
  // the rest of this drawer session (so they aren't re-prompted per field).
  const [overrideReason, setOverrideReason] = useState("");
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [pendingSave, setPendingSave] = useState<{
    extra?: Partial<EnquiryType>;
    advance: boolean;
  } | null>(null);
  // Therapist reassignment reason (dropdown) for non-admins.
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignReasonSel, setReassignReasonSel] = useState("");
  const [pendingAssignment, setPendingAssignment] =
    useState<Partial<EnquiryType> | null>(null);

  // ── Step 5 staging ──
  // The therapist assignment is composed locally (day → free cell) and written
  // in ONE save on confirm. Every PUT re-derives the invoice and re-uploads the
  // PDF, so a field-by-field autosave here would hammer UploadThing.
  const [assignDate, setAssignDate] = useState("");
  const [assignDateOpen, setAssignDateOpen] = useState(false);
  const [assignPick, setAssignPick] = useState<{
    doctorId: string;
    doctor: string;
    time: string;
  } | null>(null);
  // Visit length owned by the drawer - the grid is a controlled child. Seeded
  // from the record's saved span on open (see the seed effect below).
  const [assignDuration, setAssignDuration] = useState(60);
  // A too-close candidate is staged here (with its already-built change and any
  // reassign reason) until the exec confirms the warn dialog.
  const [pendingTooClose, setPendingTooClose] = useState<{
    change: Partial<EnquiryType>;
    conflict: ConflictResult;
    reason?: string;
  } | null>(null);
  // Once assigned the grid collapses to a summary; "Change" re-opens it. Keeps
  // a settled booking from being one stray click away from a reassignment.
  const [editingAssignment, setEditingAssignment] = useState(false);

  // Re-seed every local buffer when the drawer switches record.
  useEffect(() => {
    setDraft(record);

    // Price the booking from its type without waiting for a click. The type is
    // whatever the customer already chose (public form) or what their service
    // implies - either way the fee follows it from the catalogue, so a booking
    // that's already decided opens already priced. Local seed only - it persists
    // on the first real save (every save sends the full draft), so opening a
    // lead writes nothing.
    if (record) {
      const type =
        record.typeOfappointment ?? bookingTypeFromService(record.service);
      if (type) {
        const fee = catalogueFee(type, services);
        setDraft((d) =>
          d
            ? {
                ...d,
                typeOfappointment: type,
                // Pre-fill the catalogue fee unless a real price is already set.
                // A positive quotedPrice is a deliberate amount (maybe an
                // exception) and must survive; null/0 means "not priced yet".
                ...(fee !== undefined && (d.quotedPrice ?? 0) <= 0
                  ? { quotedPrice: fee }
                  : {}),
              }
            : d,
        );
      }
    }

    setOverrideReason("");
    setAssignDate(record?.physioSlot?.date ?? "");
    setAssignPick(
      record?.doctorId && record?.physioSlot?.time
        ? {
            doctorId: record.doctorId,
            doctor: record.doctor ?? "",
            time: record.physioSlot.time,
          }
        : null,
    );
    // Seed the visit length from the saved span; fall back to 60 when it's
    // missing or unparseable so the control never holds NaN.
    const seededDuration =
      record?.therapyStartTime && record?.therapyEndTime
        ? toMinutes(record.therapyEndTime) - toMinutes(record.therapyStartTime)
        : NaN;
    setAssignDuration(
      Number.isFinite(seededDuration) && seededDuration > 0
        ? seededDuration
        : 60,
    );
    setPendingTooClose(null);
    setEditingAssignment(false);
  }, [record]);

  // Only NOW is it safe to early-return - hooks above have all run.
  if (!record || !draft) return null;

  const bookingFee = draft.typeOfappointment
    ? catalogueFee(draft.typeOfappointment, services)
    : undefined;

  // A therapist is already locked in on the saved record.
  const hasAssignment = Boolean(draft.doctorId && (draft.physioSlot?.time || draft.slot?.time));
  // The staged pick already matches what's saved - nothing left to confirm.
  const isAssigned = Boolean(
    assignPick &&
      draft.doctorId === assignPick.doctorId &&
      (draft.physioSlot?.time || draft.slot?.time) === assignPick.time &&
      (draft.physioSlot?.date || toDayKey(draft.slot?.date)) === assignDate,
  );
  // Collapse to a summary once settled, until the user asks to change it.
  const showPicker = !hasAssignment || editingAssignment;

  function patch(partial: Partial<EnquiryType>) {
    setDraft({ ...draft!, ...partial });
  }

  /**
   * Build a patch object that, on top of the requested changes, also performs
   * the funnel-progress auto-cascade:
   *   - Sets `executiveReachedOut: true` (if not already) when any funnel
   *     advancement happens (slot booked, checkpoint ticked).
   *   - Captures `reachedOutBy` to the current user (if not already set).
   *   - Sets `executiveReachedOutAt` to now (if not already set).
   *   - Flips status `enquiry → scheduled` (if currently enquiry).
   *
   * The caller passes the actual change (e.g. consultationSlot) plus a flag
   * indicating this is a funnel-advancing action. Returns the merged patch.
   */
  function withCascade(
    requested: Partial<EnquiryType>,
    isFunnelAdvance: boolean,
  ): Partial<EnquiryType> {
    if (!isFunnelAdvance) return requested;
    const d = draft!; // null-narrowed by the early return above
    const out: Partial<EnquiryType> = { ...requested };

    // Auto-tick reach-out if not already.
    if (!d.executiveReachedOut) {
      out.executiveReachedOut = true;
      out.executiveReachedOutAt = new Date().toISOString();
    }

    // Capture "handled by" if not already set - the first person to take action on this lead.
    if (!d.reachedOutBy && currentUser) {
      out.reachedOutBy = {
        userId: currentUser.id,
        name: `${currentUser.userfName} ${currentUser.userlName}`.trim(),
      };
    }

    // Auto-flip status if still on default "enquiry".
    if ((d.status ?? "enquiry") === "enquiry") {
      out.status = "scheduled";
    }

    return out;
  }

  function save(
    extra?: Partial<EnquiryType>,
    isFunnelAdvance = false,
    reason?: string,
  ) {
    const merged = extra ? withCascade(extra, isFunnelAdvance) : {};
    const next = { ...draft!, ...merged };
    const effectiveReason = (reason ?? overrideReason).trim();

    // Soft lock (T3/T5): a non-owner exec must give a reason before editing.
    if (!canEdit && !effectiveReason) {
      toast.warning(`This lead is owned by ${ownerName} - add a reason to edit.`);
      setPendingSave({ extra, advance: isFunnelAdvance });
      setReasonDraft("");
      setReasonDialogOpen(true);
      return;
    }

    const payload: EnquiryType = effectiveReason
      ? { ...next, overrideReason: effectiveReason }
      : next;
    update(payload, {
      onSuccess: () => {
        setDraft(next);
        setSavedOnce(true);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  // Confirm the override-reason dialog → remember it + run the deferred save.
  function confirmOverrideReason() {
    const r = reasonDraft.trim();
    if (!r) {
      toast.error("Add a reason to edit this lead");
      return;
    }
    setOverrideReason(r);
    setReasonDialogOpen(false);
    const p = pendingSave;
    setPendingSave(null);
    if (p) save(p.extra, p.advance, r);
  }

  function currentActorName() {
    if (!currentUser) return "Someone";
    return (
      `${currentUser.userfName ?? ""} ${currentUser.userlName ?? ""}`.trim() ||
      "Someone"
    );
  }

  // Apply a staged status change - requires a non-empty reason note, which is
  // recorded as an activity-log entry.
  function applyStatusOverride() {
    if (!pendingStatus) return;
    const note = overrideNote.trim();
    if (!note) {
      toast.error("Add a reason note for the status change");
      return;
    }
    const entry: ActivityEntry = {
      at: new Date().toISOString(),
      userId: currentUser?.id,
      name: currentActorName(),
      action: `Status → ${STATUS_LABELS[pendingStatus] ?? pendingStatus}: ${note}`,
    };
    save({
      status: pendingStatus,
      statusNote: note,
      activityLog: [...(draft!.activityLog ?? []), entry],
    });
    setPendingStatus(null);
    setOverrideNote("");
  }

  function handleDelete() {
    if (!draft?._id) return;
    del(draft._id, {
      onSuccess: () => {
        setConfirmDeleteOpen(false);
        onClose();
      },
    });
  }

  function toggleReachedOut(checked: boolean) {
    save(
      {
        executiveReachedOut: checked,
        executiveReachedOutAt: checked ? new Date().toISOString() : undefined,
      },
      checked, // ticking ON is a funnel advance (captures reachedOutBy etc.)
    );
  }

  // Log a failed call attempt ("no answer"). Deliberately NOT a funnel advance:
  // status stays "enquiry" and executiveReachedOut stays false, so the lead lands
  // on /dashboard/follow-ups rather than moving into "Attended".
  function logNoAnswer() {
    const n = (draft!.reachAttempts ?? 0) + 1;
    const entry: ActivityEntry = {
      at: new Date().toISOString(),
      userId: currentUser?.id,
      name: currentActorName(),
      action: `Attempted to call - no answer (#${n})`,
    };
    save({
      reachAttempts: n,
      lastAttemptAt: new Date().toISOString(),
      activityLog: [...(draft!.activityLog ?? []), entry],
      // Claim ownership on the first attempt (without advancing the funnel) so
      // "Handled by" shows who's chasing the lead.
      reachedOutBy:
        draft!.reachedOutBy ??
        (currentUser
          ? {
              userId: currentUser.id,
              name: currentActorName(),
            }
          : undefined),
    });
  }

  // ── Step 3: confirm the booking ──
  // The fee belongs to the type, so switching type re-prices from the
  // catalogue. It stays editable afterwards - exceptions happen.
  function chooseBookingType(t: BookingType) {
    const fee = catalogueFee(t, services);
    save(
      {
        typeOfappointment: t,
        ...(fee !== undefined ? { quotedPrice: fee } : {}),
      },
      true,
    );
  }

  // ── Step 4: payment - the gate for step 5 ──
  function togglePayment(checked: boolean) {
    if (!checked) {
      // Un-ticking re-locks the therapist step; the assignment itself stands.
      save({
        paymentReceived: false,
        paymentReceivedAt: undefined,
        status: "scheduled",
      });
      return;
    }
    if (!draft?.typeOfappointment) {
      toast.error("Confirm the booking type first");
      return;
    }
    // The amount field shows the fee until the executive overrides it.
    const amount = draft.paymentAmount ?? draft.quotedPrice;
    if (!amount) {
      toast.error("Enter the amount received");
      return;
    }

    save(
      {
        paymentReceived: true,
        paymentReceivedAt: new Date().toISOString(),
        paymentAmount: amount,
        // Paid but not yet assigned - step 5 moves it to "ongoing".
        status: "scheduled",
        activityLog: [
          ...(draft.activityLog ?? []),
          {
            at: new Date().toISOString(),
            userId: currentUser?.id,
            name: currentActorName(),
            action: `Payment received ${formatINR(amount)}${
              draft.paymentMethod ? ` (${draft.paymentMethod})` : ""
            }`,
          },
        ],
      },
      true,
    );
  }

  // ── Step 5: assign the therapist → the booking lands on Appointments ──
  function confirmAssignment() {
    if (!assignDate || !assignPick) return;
    // The backend never prices from the rate table - if the frontend doesn't
    // send a quotedPrice the record is unpriceable and generates NO invoice.
    if (!draft?.quotedPrice) {
      toast.error("Set the booking fee in step 3 - without it no invoice is raised.");
      return;
    }

    // The candidate span: start time from the grid + the chosen duration.
    const startMin = toMinutes(assignPick.time);
    const endMin = startMin + assignDuration;
    const end = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(
      endMin % 60,
    ).padStart(2, "0")}`;

    const change: Partial<EnquiryType> = {
      physioSlot: { date: assignDate, time: assignPick.time },
      therapyStartTime: assignPick.time,
      therapyEndTime: end,
      doctorId: assignPick.doctorId,
      doctor: assignPick.doctor,
      status: "ongoing",
      activityLog: [
        ...(draft.activityLog ?? []),
        {
          at: new Date().toISOString(),
          userId: currentUser?.id,
          name: currentActorName(),
          action: `Assigned ${assignPick.doctor} - ${assignDate} ${assignPick.time}-${end}`,
        },
      ],
    };

    // Touching a booking that's already settled always confirms first - a
    // stray click must never silently move a customer's visit. Non-admins
    // additionally have to give a reason for the trail. The conflict check
    // runs AFTER that reason is given (in the dialog's confirm), never before.
    if (hasAssignment) {
      setPendingAssignment(change);
      setReassignReasonSel("");
      setReassignOpen(true);
      return;
    }
    attemptSave(change);
  }

  // Run the conflict check over the FULL candidate span, then gate the save:
  //   overlap   → blocked with a toast (never reaches the warn dialog),
  //   too-close → stage it and open the soft-warn dialog,
  //   ok        → save straight through.
  // A reassignment `reason` rides along so it survives the warn dialog detour.
  function attemptSave(change: Partial<EnquiryType>, reason?: string) {
    if (!assignPick) return;
    const conflict = checkConflict(
      {
        doctorId: assignPick.doctorId,
        date: assignDate,
        startTime: assignPick.time,
        durationMin: assignDuration,
      },
      appointments,
      gapMinutes,
      { excludeId: draft?._id },
    );
    if (conflict.status === "overlap") {
      toast.error(
        `${assignDuration} min from ${assignPick.time} runs into ${conflict.with?.name}'s ${conflict.with?.time} visit - shorten it or pick another start.`,
      );
      return;
    }
    if (conflict.status === "too-close") {
      setPendingTooClose({ change, conflict, reason });
      return;
    }
    save(change, true, reason);
  }

  /**
   * Ask the customer to pay: mint the booking's payment link and open WhatsApp
   * with a short, factual memo.
   *
   * Tone is deliberate. The customer just spoke to this executive, so the memo
   * names the clinic, quotes the booking ID and the exact item and amount, and
   * sends them to a page that shows the same before any money moves. It never
   * invents urgency and never asks for a credential - that's what separates it
   * from the scam texts everyone gets.
   */
  async function requestPaymentWa() {
    if (!draft?._id) return;
    const amount = draft.paymentAmount ?? draft.quotedPrice;
    if (!draft.typeOfappointment || !amount) {
      toast.error("Confirm the booking type and fee first");
      return;
    }
    if (!toWhatsAppNumber(draft.phonenumber)) {
      toast.error("This lead has no usable phone number");
      return;
    }

    setRequestingPayment(true);
    const result = await createPaymentLink(draft._id);
    setRequestingPayment(false);
    if (!result.success || !result.data?.payToken) {
      toast.error(result.message || "Couldn't create the payment link");
      return;
    }

    const url = `${publicOrigin()}/pay/${result.data.payToken}`;
    const item = bookingTypeLabel(draft.typeOfappointment) ?? "Consultation";
    const msg = paymentRequestMessage({
      name: draft.name,
      bookingId: draft.enquiryId,
      item,
      amount,
      payUrl: url,
    });

    const wa = whatsAppLink(draft.phonenumber, msg);
    if (!wa) {
      toast.error("This lead has no usable phone number");
      return;
    }
    window.open(wa, "_blank", "noopener,noreferrer");
    save({
      activityLog: [
        ...(draft.activityLog ?? []),
        {
          at: new Date().toISOString(),
          userId: currentUser?.id,
          name: currentActorName(),
          action: `Sent payment request ${formatINR(amount)} (${item})`,
        },
      ],
    });
  }

  function sendPaymentConfirmationWa() {
    if (!draft?.paymentReceived || !draft?.paymentReceivedAt) return;

    // Only mention the visit once a therapist has actually been assigned.
    const visitLabel =
      draft.slot?.date && draft.slot?.time
        ? `${bookingTypeLabel(draft.typeOfappointment) ?? "Visit"}: ${toDayKey(
            draft.slot.date,
          )} ${draft.slot.time}${draft.doctor ? ` with ${draft.doctor}` : ""}`
        : "";

    const msg = paymentConfirmedMessage({
      name: draft.name,
      amount: draft.paymentAmount,
      method: draft.paymentMethod,
      receivedAt: draft.paymentReceivedAt,
      visitLabel,
    });

    const wa = whatsAppLink(draft.phonenumber, msg);
    if (!wa) {
      toast.error("This lead has no usable phone number");
      return;
    }
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  const activity = buildActivity(draft);

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {/* Wide enough for the therapist × time-slot grid to breathe - 12 slots
          plus a therapist name column don't fit in the default sm:max-w-xl. */}
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {draft.enquiryId && <BookingIdBadge record={draft} />}
            {draft.name || "Unnamed"} <EnquiryStatusBadge record={draft} />
          </SheetTitle>
          <SheetDescription>
            Advance the lead through the funnel. All changes save on click.
          </SheetDescription>
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 h-4"
            aria-live="polite"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : savedOnce ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                All changes saved
              </>
            ) : null}
          </div>
        </SheetHeader>

        <div className="p-4 space-y-6">
          <RecordIds appointment={draft} />

          {/* Through this drawer's own save(), so the draft it autosaves stays
              in step and the owner lock still applies. */}
          <BookingSourceEditor
            key={draft._id}
            record={draft}
            saving={isUpdating}
            onSave={(patch) => save(patch)}
          />

          {/* ── Progress overview ── */}
          <EnquiryProgressStepper record={draft} />

          {/* ── Section: Lead info ── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">1. Lead info</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setEditingLead((v) => !v)}
              >
                {editingLead ? (
                  "Done"
                ) : (
                  <>
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </>
                )}
              </Button>
            </div>

            {!editingLead && (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {(
                  [
                    ["Name", draft.name],
                    ["Phone", draft.phonenumber ? String(draft.phonenumber) : ""],
                    ["Email", draft.email],
                    ["Age", draft.age ? String(draft.age) : ""],
                    ["Location", draft.location],
                    ["Preferred call", formatTimeRange(draft.preferredReachOutTime)],
                  ] as [string, string | undefined][]
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="truncate text-sm" title={value || undefined}>
                      {value?.trim() || "-"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-3",
                !editingLead && "hidden",
              )}
            >
              <LabeledInput
                label="Name"
                value={draft.name ?? ""}
                onChange={(v) => patch({ name: v })}
                onBlur={() => save()}
              />
              <LabeledInput
                label="Phone"
                type="tel"
                value={String(draft.phonenumber ?? "")}
                onChange={(v) => {
                  const digits = toPhoneDigits(v);
                  patch({ phonenumber: digits === "" ? undefined : Number(digits) });
                }}
                onBlur={() => save()}
              />
              <LabeledInput
                label="Email"
                value={draft.email ?? ""}
                onChange={(v) => patch({ email: v })}
                onBlur={() => save()}
              />
              <LabeledInput
                label="Age"
                type="number"
                value={String(draft.age ?? "")}
                onChange={(v) => patch({ age: Number(v) })}
                onBlur={() => save()}
              />
              <LabeledInput
                label="Location"
                value={draft.location ?? ""}
                onChange={(v) => patch({ location: v })}
                onBlur={() => save()}
              />
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">
                  Preferred reach-out
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="time"
                    aria-label="Preferred reach-out from"
                    value={draft.preferredReachOutTime?.from ?? ""}
                    onChange={(e) =>
                      patch({
                        preferredReachOutTime: {
                          from: e.target.value,
                          to: draft.preferredReachOutTime?.to ?? "",
                        },
                      })
                    }
                    onBlur={() => save()}
                  />
                  <Input
                    type="time"
                    aria-label="Preferred reach-out to"
                    value={draft.preferredReachOutTime?.to ?? ""}
                    onChange={(e) =>
                      patch({
                        preferredReachOutTime: {
                          from: draft.preferredReachOutTime?.from ?? "",
                          to: e.target.value,
                        },
                      })
                    }
                    onBlur={() => save()}
                  />
                </div>
              </div>
            </div>

            {(draft.service || (draft.vitals && draft.vitals.length > 0)) && (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md border bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Offering
                </span>
                <span className="text-sm font-medium">
                  {draft.service ?? "-"}
                </span>
                {draft.vitals?.map((v) => (
                  <span
                    key={v}
                    className="rounded-full border bg-background px-1.5 py-0.5 text-[10px]"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Note
              </label>
              <Textarea
                className="min-h-[56px] text-sm"
                value={draft.note ?? ""}
                onChange={(e) => patch({ note: e.target.value })}
                onBlur={() => save()}
              />
            </div>
          </section>

          {/* ── Section: Reach out ── */}
          <section id="enq-sec-reach" className="space-y-2 border-t pt-4 scroll-mt-4">
            <h3 className="text-sm font-semibold">2. Executive reach-out</h3>
            <p className="text-xs text-muted-foreground">
              A quick call to reach the customer and agree what they need - no
              charge.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.executiveReachedOut ?? false}
                onChange={(e) => toggleReachedOut(e.target.checked)}
              />
              Mark as reached out
            </label>
            {draft.executiveReachedOutAt && (
              <p className="text-xs text-muted-foreground">
                Reached out at{" "}
                {new Date(draft.executiveReachedOutAt).toLocaleString()}
              </p>
            )}

            {/* Couldn't-connect path - only relevant until we successfully reach them. */}
            {!draft.executiveReachedOut && (
              <div className="space-y-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={logNoAnswer}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-400"
                >
                  <PhoneMissed className="mr-2 h-4 w-4" />
                  Couldn&apos;t connect (no answer)
                </Button>
                {(draft.reachAttempts ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Attempts: {draft.reachAttempts}
                    {draft.lastAttemptAt &&
                      ` · last ${new Date(draft.lastAttemptAt).toLocaleString()}`}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Section: Confirm booking ── */}
          <section
            id="enq-sec-booking"
            className="space-y-3 border-t pt-4 scroll-mt-4"
          >
            <h3 className="text-sm font-semibold">3. Confirm booking</h3>
            <p className="text-xs text-muted-foreground">
              What the customer agreed to on the call.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {BOOKING_TYPES.map((b) => {
                const fee = catalogueFee(b.value, services);
                const active = draft.typeOfappointment === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseBookingType(b.value)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <span className="block text-sm font-medium">{b.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fee !== undefined ? formatINR(fee) : "Not in catalogue"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Fee (₹)</label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                disabled={!draft.typeOfappointment}
                value={draft.quotedPrice ?? ""}
                onChange={(e) =>
                  patch({
                    quotedPrice:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
                onBlur={() => save()}
              />
              {!draft.typeOfappointment ? (
                <p className="text-xs text-muted-foreground pt-1">
                  Pick a booking type - the fee pre-fills from the Services
                  catalogue.
                </p>
              ) : bookingFee === undefined ? (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                  &ldquo;
                  {
                    BOOKING_TYPES.find(
                      (b) => b.value === draft.typeOfappointment,
                    )?.serviceName
                  }
                  &rdquo; isn&apos;t on the Services page - add it there so the
                  fee pre-fills, or type it in here.
                </p>
              ) : draft.quotedPrice !== bookingFee ? (
                <p className="text-xs text-muted-foreground pt-1">
                  Catalogue price is {formatINR(bookingFee)} - this booking is
                  an exception.
                </p>
              ) : null}
            </div>
          </section>

          {/* ── Section: Payment - the gate for the therapist step ── */}
          <section
            id="enq-sec-payment"
            className="space-y-3 border-t pt-4 scroll-mt-4"
          >
            <h3 className="text-sm font-semibold">4. Payment</h3>
            <p className="text-xs text-muted-foreground">
              Payment must be clear before a therapist is assigned.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  Amount (₹)
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={draft.paymentAmount ?? draft.quotedPrice ?? ""}
                  onChange={(e) =>
                    patch({
                      paymentAmount:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  onBlur={() => save()}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Method</label>
                <Select
                  value={draft.paymentMethod ?? ""}
                  onValueChange={(v) =>
                    save({ paymentMethod: v as EnquiryType["paymentMethod"] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label
                className={cn(
                  "flex items-center gap-2 text-sm",
                  !draft.typeOfappointment && "opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.paymentReceived ?? false}
                  disabled={!draft.typeOfappointment}
                  onChange={(e) => togglePayment(e.target.checked)}
                />
                Payment received
              </label>
              {/* Before the money lands, the useful action is asking for it;
                  afterwards, it's acknowledging it. Only ever show one. */}
              {draft.paymentReceived ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={!draft.paymentReceivedAt}
                  onClick={sendPaymentConfirmationWa}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send confirmation
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={
                    !draft.typeOfappointment ||
                    !(draft.paymentAmount ?? draft.quotedPrice) ||
                    requestingPayment
                  }
                  onClick={requestPaymentWa}
                >
                  {requestingPayment ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4 mr-2" />
                  )}
                  Request payment
                </Button>
              )}
            </div>
            {draft.paymentReceived && draft.paymentReceivedAt ? (
              <p className="text-xs text-muted-foreground">
                Received
                {draft.paymentAmount
                  ? ` ${formatINR(draft.paymentAmount)}`
                  : ""}
                {draft.paymentMethod ? ` via ${draft.paymentMethod}` : ""} on{" "}
                {new Date(draft.paymentReceivedAt).toLocaleString()}
              </p>
            ) : !draft.typeOfappointment ? (
              <p className="text-xs text-muted-foreground">
                Confirm the booking type in step 3 before recording payment.
              </p>
            ) : null}
          </section>

          {/* ── Section: Assign therapist - the last step of the enquiry ── */}
          <section
            id="enq-sec-therapist"
            className="space-y-3 border-t pt-4 scroll-mt-4"
          >
            <h3 className="text-sm font-semibold">5. Assign therapist</h3>
            <p className="text-xs text-muted-foreground">
              Confirming puts this booking on the Appointments page - the
              enquiry is then done.
            </p>

            {!draft.paymentReceived && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                Record payment first.
              </p>
            )}

            {/* Settled booking - collapsed. The grid is one deliberate click away. */}
            {hasAssignment && !editingAssignment && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
                <p className="min-w-0 text-sm">
                  <span className="font-medium">{draft.doctor}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {draft.physioSlot?.date ?? "Not set"} at {draft.physioSlot?.time ?? ""}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setEditingAssignment(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Change
                </Button>
              </div>
            )}

            {showPicker && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Visit date
                  </label>
                  <Popover
                    open={assignDateOpen}
                    onOpenChange={setAssignDateOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!draft.paymentReceived}
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {assignDate ? (
                          format(new Date(assignDate), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={assignDate ? new Date(assignDate) : undefined}
                        disabled={{ before: startOfToday() }}
                        onSelect={(d) => {
                          if (d) setAssignDate(format(d, "yyyy-MM-dd"));
                          setAssignDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {draft.paymentReceived && assignDate && (
                  <TherapistAvailabilityGrid
                    date={assignDate}
                    selectedDoctorId={assignPick?.doctorId}
                    selectedStart={assignPick?.time}
                    excludeRecordId={draft._id}
                    durationMin={assignDuration}
                    onDurationChange={setAssignDuration}
                    onPick={(p) =>
                      setAssignPick({
                        doctorId: p.doctorId,
                        doctor: p.doctor,
                        time: p.startTime,
                      })
                    }
                  />
                )}

                {draft.paymentReceived && assignDate && assignPick && (
                  <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-2.5 py-2">
                    <p className="min-w-0 text-sm">
                      <span className="font-medium">{assignPick.doctor}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {assignDate} at {assignPick.time}
                      </span>
                    </p>
                    <div className="flex shrink-0 gap-2">
                      {hasAssignment && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingAssignment(false);
                            setAssignDate(draft.physioSlot?.date ?? "");
                            setAssignPick(
                              draft.doctorId && draft.physioSlot?.time
                                ? {
                                    doctorId: draft.doctorId,
                                    doctor: draft.doctor ?? "",
                                    time: draft.physioSlot.time,
                                  }
                                : null,
                            );
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={isAssigned || isUpdating}
                        onClick={confirmAssignment}
                      >
                        {isAssigned ? "Assigned" : "Confirm assignment"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Section: Activity (audit log) ── */}
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Activity</h3>
              {draft.reachedOutBy?.name && isAdmin && !editingReachedBy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setEditingReachedBy(true)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Reassign handler
                </Button>
              )}
            </div>

            {/* Handled-by summary + admin reassign */}
            {draft.reachedOutBy?.name &&
              (!editingReachedBy ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Handled by </span>
                  <span className="font-medium">{draft.reachedOutBy.name}</span>
                </p>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={draft.reachedOutBy?.userId ?? ""}
                    onValueChange={(userId) => {
                      const u = users?.find((x) => x._id === userId);
                      if (!u) return;
                      const name = `${u.userfName} ${u.userlName}`.trim();
                      const entry: ActivityEntry = {
                        at: new Date().toISOString(),
                        userId: currentUser?.id,
                        name: currentActorName(),
                        action: `Reassigned handler to ${name}`,
                      };
                      save({
                        reachedOutBy: { userId: u._id, name },
                        activityLog: [...(draft.activityLog ?? []), entry],
                      });
                      setEditingReachedBy(false);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Reassign…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(users ?? []).map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.userfName} {u.userlName} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingReachedBy(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}

            {/* Timeline */}
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {activity.map((e, i) => (
                  <li
                    key={`${e.at}-${i}`}
                    className="text-xs border-l-2 border-muted pl-3 pb-0.5"
                  >
                    <div className="text-foreground">{tidyActivityText(e.action)}</div>
                    <div className="text-muted-foreground">
                      {e.name}
                      {" · "}
                      {new Date(e.at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* ── Section: Status override (permission-gated) ── */}
          <section className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Status override</h3>
              {!canEditStatus && (
                <span className="text-xs text-muted-foreground">
                  Read-only
                </span>
              )}
            </div>
            <Select
              value={pendingStatus ?? draft.status ?? "enquiry"}
              disabled={!canEditStatus}
              onValueChange={(v) => {
                const next = v as EnquiryType["status"];
                const current = draft.status ?? "enquiry";
                if (next === current) {
                  setPendingStatus(null);
                  setOverrideNote("");
                  return;
                }
                if (next === "cancelled") {
                  // Cancelling requires a reason - stage it and ask.
                  setPendingStatus(next);
                  return;
                }
                // Any other status change saves immediately (and is logged).
                const entry: ActivityEntry = {
                  at: new Date().toISOString(),
                  userId: currentUser?.id,
                  name: currentActorName(),
                  action: `Changed status to ${STATUS_LABELS[next as string] ?? next}`,
                };
                save({
                  status: next,
                  activityLog: [...(draft.activityLog ?? []), entry],
                });
                setPendingStatus(null);
                setOverrideNote("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enquiry">Enquiry</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Required reason note - only when cancelling a lead. */}
            {pendingStatus === "cancelled" && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <label className="text-sm font-medium">
                  Reason for cancellation
                  <span className="text-destructive"> *</span>
                </label>
                <Textarea
                  autoFocus
                  placeholder="Why is this lead being cancelled? (required)"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPendingStatus(null);
                      setOverrideNote("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!overrideNote.trim() || isUpdating}
                    onClick={applyStatusOverride}
                  >
                    Apply change
                  </Button>
                </div>
              </div>
            )}

            {!canEditStatus && (
              <p className="text-xs text-muted-foreground">
                Only admins or {draft.reachedOutBy?.name ?? "the person who handled this lead"} can change status.
              </p>
            )}
          </section>

          {/* ── Section: Footer actions ── */}
          <section className="flex justify-between items-center border-t pt-4">
            <Button
              variant="destructive"
              disabled={isDeleting || isUpdating}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting…
                </span>
              ) : (
                "Delete enquiry"
              )}
            </Button>

            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </section>
        </div>
      </SheetContent>

      {/* AlertDialog lives OUTSIDE the SheetContent (but still inside the
          Sheet root - that's fine; the bug was about it being inside the
          SheetContent's pointer-events trap). Controlled by React state
          instead of an AlertDialogTrigger, so the first click on the
          destructive Button opens the confirm reliably. */}
    </Sheet>

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete enquiry?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the record. Cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* T3/T5: reason required to edit another exec's lead */}
    <AlertDialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editing {ownerName}&apos;s lead</AlertDialogTitle>
          <AlertDialogDescription>
            This lead is owned by {ownerName}. Add a reason to edit it - it&apos;s
            recorded in the activity trail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          autoFocus
          placeholder="Reason for editing this lead (required)"
          value={reasonDraft}
          onChange={(e) => setReasonDraft(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingSave(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirmOverrideReason();
            }}
          >
            Save with reason
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Changing a settled booking always confirms. Non-admins also give a reason. */}
    <AlertDialog open={reassignOpen} onOpenChange={setReassignOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            This visit is already confirmed. The customer has been told who is
            coming and when - only change it if that&apos;s really what you
            mean to do.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Now: </span>
            {draft?.doctor} · {draft?.physioSlot?.date ?? "Not set"} at{" "}
            {draft?.physioSlot?.time ?? ""}
          </p>
          <p>
            <span className="text-muted-foreground">Change to: </span>
            <span className="font-medium">
              {pendingAssignment?.doctor} · {assignDate} at{" "}
              {pendingAssignment?.physioSlot?.time}
            </span>
          </p>
        </div>

        {!isAdmin && (
          <Select value={reassignReasonSel} onValueChange={setReassignReasonSel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a reason" />
            </SelectTrigger>
            <SelectContent>
              {REASSIGN_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingAssignment(null)}>
            Keep it as it is
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (!isAdmin && !reassignReasonSel) {
                toast.error("Pick a reason for the reassignment");
                return;
              }
              const p = pendingAssignment;
              setReassignOpen(false);
              setPendingAssignment(null);
              setEditingAssignment(false);
              // Reason first, then the conflict check on the full span.
              if (p) attemptSave(p, reassignReasonSel || undefined);
            }}
          >
            Yes, move it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* T9: soft-warn when the start is within the booking gap of another visit.
        Overlap never reaches here - it's blocked at the toast in attemptSave. */}
    <AlertDialog
      open={pendingTooClose !== null}
      onOpenChange={(o) => {
        if (!o) setPendingTooClose(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Within the booking gap</AlertDialogTitle>
          <AlertDialogDescription>
            This start is within {gapMinutes} min of{" "}
            {pendingTooClose?.conflict.with?.name}&apos;s{" "}
            {pendingTooClose?.conflict.with?.time} visit. Book anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingTooClose(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              const p = pendingTooClose;
              setPendingTooClose(null);
              if (p) save(p.change, true, p.reason);
            }}
          >
            Book anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── Local helpers ──

/**
 * Build a chronological activity timeline of EXECUTIVE actions only -
 * name · what they did · timestamp. No "system" events.
 *
 * Merges the backend-stored `activityLog` (real per-action attribution, once
 * the backend supports the field) with milestones DERIVED from the timestamp
 * fields we already persist. Derived milestones are only included when we know
 * which person to attribute them to (the lead's handler) - anything we can't
 * tie to a person is left out rather than shown as "system".
 */
function buildActivity(d: EnquiryType): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const handler = d.reachedOutBy?.name;
  const handlerId = d.reachedOutBy?.userId;

  if (handler) {
    if (d.executiveReachedOutAt) {
      entries.push({
        at: d.executiveReachedOutAt,
        userId: handlerId,
        name: handler,
        action: "Reached out to lead",
      });
    }
  }

  // Stored log entries (status changes, reassignments, future backend log).
  if (d.activityLog?.length) entries.push(...d.activityLog);

  // Defensive: never show non-executive ("System") rows.
  return entries
    .filter((e) => e.name && e.name !== "System")
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function LabeledInput({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

