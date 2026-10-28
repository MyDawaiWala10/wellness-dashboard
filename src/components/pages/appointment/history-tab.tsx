"use client";

import { useEffect, useState } from "react";
import { toDayKey } from "@/components/pages/enquiries/booking";
import { format } from "date-fns";

import type { slotBookingZodType } from "@/type/schema";
import { NotesTimeline } from "@/components/notes-timeline";
import { buildNotesTimeline } from "@/lib/notes-timeline";
import type { CustomerNote } from "@/type/customer-record";
import { tidyActivityText } from "@/lib/utils";
import { getCustomerByPhone } from "@/actions/customers/get-customer-by-phone";

/**
 * The record of what has already happened: every note about this customer
 * (theirs, their therapists', the office's), then the audit trail.
 *
 * Past notes are read-only and one tap away - the therapist writes in the Visit
 * tab, and nothing here can be quietly rewritten later.
 */
export function HistoryTab({
  appointment,
  visits = [],
  personBookings,
}: {
  appointment: slotBookingZodType;
  /** This booking's later visits; their activity is shown here too. */
  visits?: slotBookingZodType[];
  /** All of this person's bookings (same phone and name), for their notes. */
  personBookings?: slotBookingZodType[];
}) {
  const activity = [
    ...(appointment.activityLog ?? []),
    // Each later visit's own log, labelled with which visit it was.
    ...visits.flatMap((v) =>
      (v.activityLog ?? []).map((e) => ({
        ...e,
        action: `[${v.service ?? "Visit"}${v.slot?.date ? ` ${toDayKey(v.slot.date)}` : ""}] ${e.action}`,
      })),
    ),
  ]
    .filter((e) => e.name && e.name !== "System")
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    async function fetchCustomerNotes() {
      if (!appointment.phonenumber) {
        setLoadingNotes(false);
        return;
      }
      const result = await getCustomerByPhone(appointment.phonenumber);
      if (result.success && result.data) {
        // Find the customer matching this appointment's name
        const customer = result.data.find(
          (c) => c.name.toLowerCase() === (appointment.name ?? "").toLowerCase(),
        );
        if (customer?.notes) {
          setCustomerNotes(customer.notes);
        }
      }
      setLoadingNotes(false);
    }
    fetchCustomerNotes();
  // Re-fetch whenever a session is completed (sessionNotes grows), so the
  // record's copy of the new note appears without a page reload.
  }, [appointment.phonenumber, appointment.name, appointment.sessionNotes?.length]);

  return (
    <div className="space-y-4">
      {/* Every note about this person, tagged Customer / Therapist / Office:
          this booking open, their earlier bookings below. */}
      {loadingNotes ? (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      ) : (
        <NotesTimeline
          timeline={buildNotesTimeline(personBookings ?? [appointment, ...visits], customerNotes)}
          openId={appointment._id}
        />
      )}

      <section className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </p>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {activity.map((e, i) => (
              <div key={i} className="border-l-2 border-muted pl-2.5 text-[11px]">
                <span className="font-mono tabular-nums text-muted-foreground">
                  {format(new Date(e.at), "yyyy-MM-dd HH:mm")}
                </span>
                {" · "}
                <span className="font-medium">{e.name}</span>
                {" - "}
                {tidyActivityText(e.action)}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
