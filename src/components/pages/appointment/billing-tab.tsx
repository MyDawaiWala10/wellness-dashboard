"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { RecordPaymentForm } from "@/components/record-payment-form";
import type { slotBookingZodType } from "@/type/schema";
import { bookingLedger } from "@/lib/booking-money";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import { formatINR } from "@/components/pages/services/services-columns";
import { Money } from "@/components/money";
import { cn } from "@/lib/utils";
import { whatsAppLink, toWhatsAppNumber } from "@/lib/whatsapp";
import { publicOrigin } from "@/lib/brand";
import {
  paymentRequestMessage,
  paymentConfirmedMessage,
} from "@/lib/payment-messages";
import createPaymentLink from "@/actions/appointments/create-payment-link";
import { AddonsVisitSection } from "./visit-sections";
import { OfferApplyBox } from "./offer-apply-box";
import { InvoiceSection } from "./invoice-section";
import { parentIdOf } from "@/lib/visit-groups";

const DOT: Record<string, string> = {
  paid: "bg-emerald-600",
  due: "bg-amber-500",
  pending: "bg-muted-foreground/40",
};

/** One line of the totals ladder. */
function Row({
  label,
  value,
  prefix,
  muted,
  strong,
  className = "",
}: {
  label: string;
  value: number;
  prefix?: string;
  muted?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between text-[12px]", className)}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <Money
        value={value}
        prefix={prefix}
        className={cn(strong && "font-semibold", muted && "text-muted-foreground")}
      />
    </div>
  );
}

/**
 * The executive's half of the panel: what was sold, what is owed, and the two
 * things they actually do about it - ask for the money, or confirm it arrived.
 *
 * Requesting payment was missing from this page entirely, so an unpaid visit had
 * to be chased from the Enquiries drawer instead. It asks for the FULL balance -
 * the booking plus any confirmed unpaid add-on - not just the booking fee.
 */
export function BillingTab({ appointment }: { appointment: slotBookingZodType }) {
  const [requesting, setRequesting] = useState(false);
  const { lines, due, paid, totals } = bookingLedger(appointment);
  // The booking's own balance (add-ons are collected on their own lines).
  const bookingDue = lines.find((l) => l.key === "booking")?.due ?? 0;

  async function requestPayment() {
    if (!appointment._id) return;
    if (!toWhatsAppNumber(appointment.phonenumber)) {
      toast.error("This customer has no usable phone number");
      return;
    }
    if (due <= 0) {
      toast.error("Nothing is outstanding on this booking");
      return;
    }
    setRequesting(true);
    const link = await createPaymentLink(appointment._id);
    setRequesting(false);
    if (!link.success || !link.data?.payToken) {
      toast.error(link.message ?? "Couldn't create the payment link");
      return;
    }
    // One memo for the whole balance: the booking and every confirmed add-on.
    const items = lines
      .filter((l) => l.state === "due")
      .map((l) => `${l.label} - ${formatINR(l.due)}`)
      .join("\n");
    const wa = whatsAppLink(
      appointment.phonenumber,
      paymentRequestMessage({
        name: appointment.name,
        bookingId: appointment.enquiryId,
        item: items || bookingLabel(appointment),
        amount: due,
        payUrl: `${publicOrigin()}/pay/${link.data.payToken}`,
      }),
    );
    if (wa) window.open(wa, "_blank", "noopener,noreferrer");
  }

  function sendReceipt() {
    const wa = whatsAppLink(
      appointment.phonenumber,
      paymentConfirmedMessage({
        name: appointment.name,
        amount: appointment.paymentAmount ?? appointment.quotedPrice,
        method: appointment.paymentMethod,
        receivedAt: appointment.paymentReceivedAt ?? new Date().toISOString(),
        visitLabel:
          appointment.slot?.date && appointment.slot?.time
            ? `${bookingLabel(appointment)}: ${appointment.slot.date} ${appointment.slot.time}`
            : "",
      }),
    );
    if (!wa) {
      toast.error("This customer has no usable phone number");
      return;
    }
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  // A visit for a later session of a recommended add-on: its money lives on
  // that add-on, on the booking it was recommended on.
  if (appointment.addonOf?.bookingId) {
    return (
      <section className="rounded-lg border p-3 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Billing
        </p>
        <p className="text-sm">
          Session {appointment.addonOf.session} of {appointment.service ?? "an add-on"}.
        </p>
        <p className="text-xs text-muted-foreground">
          It&apos;s billed on the booking it was recommended on. The therapist
          collects this session&apos;s share before starting (Verify asks for it);
          the office can also record it on that booking&apos;s Billing tab.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sold on this booking
        </p>

        {lines.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nothing priced yet - set a price under Booking terms.
          </p>
        ) : (
          <ul>
            {lines.map((l) => (
              <li
                key={l.key}
                className="flex items-center gap-2.5 border-b border-dashed py-2 last:border-0"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[l.state]}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {l.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {l.meta}
                  </span>
                </span>
                <Money
                  value={l.original ?? l.amount}
                  className="shrink-0 text-[13px] font-semibold"
                />
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="mt-2 space-y-1 border-t pt-2.5">
            {/* Only worth showing the arithmetic when something came off. */}
            {totals.discount > 0 && (
              <>
                {/* Subtotal only when there's more than one line - otherwise it
                    just repeats the single line above. */}
                {lines.length > 1 && (
                  <Row label="Subtotal" value={totals.subtotal} muted />
                )}
                <Row
                  label="Discount"
                  value={totals.discount}
                  prefix="−"
                  className="text-emerald-600 dark:text-emerald-400"
                />
              </>
            )}
            {/* Only worth a line when it differs from what's due - otherwise
                it's the same number printed twice, which is the common case. */}
            {totals.total !== due && (
              <Row label="Total" value={totals.total} strong />
            )}
            {totals.paid > 0 && (
              <Row label="Paid" value={totals.paid} muted />
            )}

            <div className="flex items-baseline justify-between pt-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {due > 0 ? "Total due" : "Collected"}
              </span>
              <Money
                value={due > 0 ? due : paid}
                className={cn(
                  "text-base font-bold",
                  due > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600",
                )}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {due > 0 ? (
            <>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={requesting}
                onClick={requestPayment}
              >
                {requesting ? "Preparing..." : "Request payment"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={sendReceipt}
            >
              Send receipt
            </Button>
          )}
        </div>

        {/* Money received, part or full - the one place it's recorded here. */}
        {bookingDue > 0 && appointment._id && (
          <div className="mt-3 space-y-1.5 rounded-md border bg-muted/30 p-2.5">
            <p className="text-[11px] font-medium">
              Record a payment for {bookingLabel(appointment)}
            </p>
            <RecordPaymentForm appointmentId={appointment._id} due={bookingDue} />
          </div>
        )}

        {(appointment.payments?.length ?? 0) > 0 && (
          <div className="mt-3 border-t pt-2.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Payments
            </p>
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {appointment.payments!.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {format(new Date(p.at), "yyyy-MM-dd HH:mm")}
                    {p.method ? ` · ${p.method === "upi" ? "UPI" : p.method}` : ""}
                    {p.by ? ` · by ${p.by}` : ""}
                    {p.for ? ` · for ${p.for}` : ""}
                  </span>
                  <Money value={p.amount} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Role-filtered offers the office can apply to each priced line. */}
      <OfferApplyBox appointment={appointment} />

      <AddonsVisitSection appointment={appointment} />
      {/* A course session or add-on visit is billed on its booking's invoice. */}
      <InvoiceSection appointmentId={parentIdOf(appointment) ?? appointment._id} />
    </div>
  );
}
