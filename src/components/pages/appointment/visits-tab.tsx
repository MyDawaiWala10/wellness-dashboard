"use client";

import type { slotBookingZodType } from "@/type/schema";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import { formatINR } from "@/components/pages/services/services-columns";
import { bookingLedger } from "@/lib/booking-money";
import { visitStatusLabel } from "@/lib/package-progress";
import { childVisitsOf, nextVisitOf, visitLabel, visitShort, visitWhen } from "@/lib/visit-groups";
import { VisitTab } from "./visit-tab";

/**
 * Every visit of a booking in one tab: the booking's own visit (with add-ons
 * done in it) and each later visit (add-on sessions, course follow-ups) - when,
 * how long, status and whether it's paid for. Each expands to its own Visit
 * steps (code, verify, collect, complete); the next one to happen starts open.
 * A booking with no later visits just shows its own steps.
 */
export function VisitsTab({
  booking,
  allAppointments,
}: {
  booking: slotBookingZodType;
  allAppointments: slotBookingZodType[];
}) {
  const visits = childVisitsOf(booking, allAppointments);
  if (visits.length === 0) {
    return <VisitTab appointment={booking} allAppointments={allAppointments} />;
  }
  const nextId = nextVisitOf(booking, allAppointments)?._id;
  const inVisitAddons = (booking.recommendedServices ?? []).filter(
    (r) => r.status === "confirmed" && r.firstInVisit !== false,
  );
  const due = bookingLedger(booking).due;

  return (
    <div className="space-y-2">
      <details open={nextId === booking._id || !nextId} className="group rounded-lg border p-3">
        <summary className="cursor-pointer list-none space-y-1">
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
        </summary>
        <div className="mt-3 border-t pt-3">
          <VisitTab appointment={booking} allAppointments={allAppointments} />
        </div>
      </details>

      {visits.map((v) => {
        const short = visitShort(v, booking);
        return (
          <details key={v._id} open={v._id === nextId} className="group rounded-lg border p-3">
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
