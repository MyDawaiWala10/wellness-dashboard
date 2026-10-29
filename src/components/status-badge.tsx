"use client";

import { Badge } from "@/components/ui/badge";

// Single source of truth for the appointment / enquiry lifecycle status badge.
// Used by the appointment drawer, enquiry drawer, appointments table, customer
// drawer, and dashboard - so the badge looks and reads identically everywhere.

const STATUS_LABEL: Record<string, string> = {
  enquiry: "Enquiry",
  scheduled: "Scheduled",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
  // A booking's visit progress, sent by the server as `visitStatus` (backend
  // lib/visitStatus.ts, client list B2 #9). Display only.
  otp_pending: "OTP Pending",
  visit_pending: "Visit Pending",
  session_live: "Session Live",
};

const STATUS_CLASS: Record<string, string> = {
  enquiry: "border-slate-400 text-slate-500",
  scheduled: "border-yellow-600 text-yellow-600",
  ongoing: "border-blue-600 text-blue-600",
  completed: "border-green-600 text-green-600",
  // The client's colours: red until the therapist enters the code (blinking
  // while no code is sent), yellow while the session runs.
  otp_pending: "border-red-600 text-red-600 motion-safe:animate-blink",
  visit_pending: "border-red-600 text-red-600",
  session_live: "border-yellow-500 bg-yellow-400/15 text-yellow-700 dark:text-yellow-400",
};

/** What a booking's badge shows everywhere: where its visits stand, else its stored status. */
export const shownStatus = (r: { status?: string; visitStatus?: string | null }) =>
  r.visitStatus ?? r.status;

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  const s = status ?? "enquiry";
  if (s === "cancelled") {
    return (
      <Badge variant="destructive" className={className}>
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={`${STATUS_CLASS[s] ?? ""} ${className ?? ""}`.trim()}
    >
      {STATUS_LABEL[s] ?? s}
    </Badge>
  );
}
