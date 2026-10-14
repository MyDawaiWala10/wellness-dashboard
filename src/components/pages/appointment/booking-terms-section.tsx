"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateAppointment } from "@/data/appointment/appointment";
import type { slotBookingZodType } from "@/type/schema";
import { bookingKindOf, bookingLabel } from "@/components/pages/enquiries/booking";

/**
 * What was sold and for how much - the definition of the booking, not its
 * payment state.
 *
 * It used to show a bare "Price" with no indication of what was being charged
 * for, alongside payment fields that repeated what the ledger above already
 * said. Payment now lives in one place (the ledger); this owns the terms.
 *
 * Saved behind an explicit button rather than on blur: every PUT re-derives the
 * invoice and re-uploads its PDF, so blur-saving would upload one per keystroke.
 */
export function BookingTermsSection({
  appointment,
}: {
  appointment: slotBookingZodType;
}) {
  const { mutate: update, isPending } = useUpdateAppointment();
  const isCourse = bookingKindOf(appointment) === "course";

  const [sessions, setSessions] = useState<number | undefined>(
    appointment.totalSessions,
  );
  const [price, setPrice] = useState<number | undefined>(appointment.quotedPrice);

  useEffect(() => {
    setSessions(appointment.totalSessions);
    setPrice(appointment.quotedPrice);
  }, [appointment._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const completed = appointment.sessionsCompleted ?? 0;
  const dirty =
    price !== appointment.quotedPrice ||
    (isCourse && sessions !== appointment.totalSessions);

  function save() {
    if (!(price && price > 0)) {
      toast.error("A booking with no price never generates an invoice");
      return;
    }
    if (isCourse && sessions !== undefined && sessions < completed) {
      toast.error(
        `${completed} session${completed === 1 ? "" : "s"} already completed - the course can't be shorter than that`,
      );
      return;
    }
    update({
      ...appointment,
      ...(isCourse ? { totalSessions: sessions } : {}),
      quotedPrice: price,
    });
  }

  return (
    <section className="rounded-lg border p-3 space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">Booking terms</h3>
        <p className="text-[11px] text-muted-foreground">
          Charging for <strong>{bookingLabel(appointment)}</strong>
          {isCourse && completed > 0
            ? ` - ${completed} already delivered`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isCourse && (
          <div>
            <label className="text-xs text-muted-foreground">
              Sessions in the course
            </label>
            <Input
              type="number"
              min={Math.max(completed, 1)}
              value={sessions ?? ""}
              onChange={(e) =>
                setSessions(
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">
            {isCourse ? "Course price (₹)" : "Fee (₹)"}
          </label>
          <Input
            type="number"
            min={0}
            // An intake's fee comes from the Services catalogue only.
            readOnly={!isCourse}
            value={price ?? ""}
            onChange={(e) =>
              setPrice(e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={isPending || !dirty}
        onClick={save}
      >
        {isPending ? "Saving..." : dirty ? "Save terms" : "Saved"}
      </Button>
    </section>
  );
}
