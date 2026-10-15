"use client";

import { useEffect, useState } from "react";
import { toDayKey } from "@/components/pages/enquiries/booking";
import { format } from "date-fns";
import { Check } from "lucide-react";

import type { ServiceType, slotBookingZodType } from "@/type/schema";
import type { CustomerNote } from "@/type/customer-record";
import { getPackageProgressForAppointment } from "@/lib/package-progress";
import { tidyActivityText } from "@/lib/utils";
import { getCustomerByPhone } from "@/actions/customers/get-customer-by-phone";

/**
 * The record of what has already happened: each completed session's clinical
 * note, then the audit trail.
 *
 * Past notes are read-only and one tap away - the therapist writes in the Visit
 * tab, and nothing here can be quietly rewritten later.
 */
export function HistoryTab({
  appointment,
  services,
  visits = [],
}: {
  appointment: slotBookingZodType;
  services: ServiceType[];
  /** This booking's later visits; their activity is shown here too. */
  visits?: slotBookingZodType[];
}) {
  const progress = getPackageProgressForAppointment(
    appointment,
    [appointment],
    services,
  );
  const notes = appointment.sessionNotes ?? [];
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
  // mirrored customer note written by the backend appears without a page reload.
  }, [appointment.phonenumber, appointment.name, appointment.sessionNotes?.length]);

  const sortedCustomerNotes = [...customerNotes].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Completed sessions
          </p>
          {progress && (
            <span className="text-[11px] text-muted-foreground">
              {progress.label}
            </span>
          )}
        </div>

        {notes.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">
            No sessions completed yet.
          </p>
        ) : (
          <div>
            {notes.map((s, i) => (
              <details key={i} className="group border-b last:border-0">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-[13px]">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="font-medium">Session {s.session}</span>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                    {s.at ? format(new Date(s.at), "dd MMM") : ""}
                    {s.therapist ? ` · ${s.therapist}` : ""}
                  </span>
                </summary>
                {s.note ? (
                  <p className="mb-2.5 ml-5 whitespace-pre-wrap rounded-r border-l-2 border-emerald-500 bg-muted/50 px-2.5 py-2 text-xs leading-relaxed">
                    {s.note}
                  </p>
                ) : (
                  <p className="mb-2.5 ml-5 text-xs italic text-muted-foreground">
                    No note was recorded for this session.
                  </p>
                )}
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Customer Notes from Therapist */}
      <section className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Therapist Notes (Customer History)
        </p>
        {loadingNotes ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : sortedCustomerNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No therapist notes for this customer yet.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedCustomerNotes.map((n, i) => (
              <div
                key={`${n.at}-${n.by}-${i}`}
                className="border-l-2 border-blue-500 pl-2.5 text-xs"
              >
                <p className="whitespace-pre-wrap">{n.note}</p>
                <p className="mt-1 text-muted-foreground">
                  {n.by} · {format(new Date(n.at), "dd MMM yyyy, h:mm a")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

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
