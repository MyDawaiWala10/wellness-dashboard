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
