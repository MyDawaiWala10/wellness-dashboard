"use client";

import type { slotBookingZodType } from "@/type/schema";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import { formatINR } from "@/components/pages/services/services-columns";
import { bookingLedger } from "@/lib/booking-money";
import { visitStatusLabel } from "@/lib/package-progress";
import { childVisitsOf, visitLabel, visitShort, visitWhen } from "@/lib/visit-groups";
import { VisitTab } from "./visit-tab";

/**
 * Every visit of a booking in one place: the booking's own visit, add-ons done
 * in it, and each later visit (add-on sessions, course follow-ups) - when, how
 * long, its status and whether it's paid for. Expanding a later visit shows its
 * own Visit steps (code, verify, complete), since it is still its own visit.
 */
export function SessionsTab({
  booking,
  allAppointments,
}: {
  booking: slotBookingZodType;
  allAppointments: slotBookingZodType[];
}) {
  const visits = childVisitsOf(booking, allAppointments);
  const inVisitAddons = (booking.recommendedServices ?? []).filter(
    (r) => r.status === "confirmed" && r.firstInVisit !== false,
  );
  const due = bookingLedger(booking).due;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border p-3 space-y-1">
        <Line
          title={`${bookingLabel(booking)} (this booking)`}
          when={visitWhen(booking)}
          status={visitStatusLabel(booking.status)}
          money={due > 0 ? `${formatINR(due)} due on this booking` : "Paid"}
          moneyDue={due > 0}
        />
        {inVisitAddons.map((r) => (
          <p key={`${r.serviceId}-${r.recommendedAt}`} className="pl-3 text-[11px] text-muted-foreground">
            + {r.serviceName}, in this visit
          </p>
        ))}
      </div>

      {visits.map((v) => {
        const short = visitShort(v, booking);
        return (
          <details key={v._id} className="group rounded-lg border p-3">
            <summary className="cursor-pointer list-none">
              <Line
                title={visitLabel(v, booking)}
                when={visitWhen(v)}
                status={visitStatusLabel(v.status)}
                money={
                  v.status === "completed"
                    ? "Done"
                    : short > 0
                      ? `${formatINR(short)} to collect before it starts`
                      : "Paid for"
                }
                moneyDue={v.status !== "completed" && short > 0}
              />
              <span className="text-[10px] text-muted-foreground group-open:hidden">
                Open to run this visit
              </span>
            </summary>
            <div className="mt-3 border-t pt-3">
              <VisitTab appointment={v} allAppointments={allAppointments} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function Line({
  title,
  when,
  status,
  money,
  moneyDue,
}: {
  title: string;
  when: string;
  status: string;
  money: string;
  moneyDue: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{when}</p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-medium">{status}</p>
        <p className={`text-[11px] ${moneyDue ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
          {money}
        </p>
      </div>
    </div>
  );
}
