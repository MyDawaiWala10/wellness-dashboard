import type { EnquiryType } from "@/type/schema";

export type FunnelStage =
  | "enquiry"
  | "follow_up"
  | "reached_out"
  | "booked"
  | "paid"
  | "assigned"
  | "completed"
  | "cancelled";

/**
 * Where a lead sits in the client-approved funnel. Ordered most-advanced first:
 * reach out → confirm the booking → payment clears → assign a therapist.
 *
 * "assigned" is the terminal enquiry stage - once a therapist is on it the
 * booking belongs to the Appointments page.
 */
export function deriveStage(r: EnquiryType): FunnelStage {
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "completed") return "completed";
  if (r.doctorId && r.slot?.time) return "assigned";
  if (r.paymentReceived) return "paid";
  // Tried to call but couldn't connect yet → needs a follow-up. Checked before
  // "booked": website leads always arrive with a type, so they'd never get here.
  if (!r.executiveReachedOut && (r.reachAttempts ?? 0) > 0) return "follow_up";
  if (r.typeOfappointment) return "booked";
  if (r.executiveReachedOut) return "reached_out";
  return "enquiry";
}

/**
 * The "Reached out" tick. Reaching a customer is not a booking, so this never
 * moves a lead to "scheduled" (that sent it to Appointments with no therapist
 * or slot). Older ticks did; unticking such a lead puts it back to "enquiry".
 */
export function reachedOutPatch(
  r: EnquiryType,
  checked: boolean,
  actor?: { userId: string; name: string },
): Partial<EnquiryType> {
  const booked = Boolean(r.doctorId || r.slot?.date || r.physioSlot?.date || r.consultationSlot?.date);
  return {
    executiveReachedOut: checked,
    executiveReachedOutAt: checked ? new Date().toISOString() : undefined,
    reachedOutBy: r.reachedOutBy ?? (checked ? actor : undefined),
    ...(!checked && r.status === "scheduled" && !booked ? { status: "enquiry" as const } : {}),
  };
}

/**
 * Which page a booking lives on: with a therapist it's on Appointments,
 * without one it stays on Enquiries until step 5 assigns one - whatever its
 * status says (the New appointment form can save one as "scheduled").
 */
export const hasTherapist = (r: { doctorId?: string | null }): boolean => Boolean(r.doctorId);

/** A lead we've attempted but not yet connected with - surfaced on /dashboard/follow-ups. */
export const isFollowUp = (r: EnquiryType): boolean => deriveStage(r) === "follow_up";

export const STAGE_LABELS: Record<FunnelStage, string> = {
  enquiry: "Enquiry",
  follow_up: "Follow-up",
  reached_out: "Reached out",
  booked: "Booked",
  paid: "Paid",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STAGE_ORDER: FunnelStage[] = [
  "enquiry",
  "follow_up",
  "reached_out",
  "booked",
  "paid",
  "assigned",
  "completed",
  "cancelled",
];
