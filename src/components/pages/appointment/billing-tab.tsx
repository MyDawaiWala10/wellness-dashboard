"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateAppointment } from "@/data/appointment/appointment";
import type { slotBookingZodType } from "@/type/schema";
import { bookingLedger } from "@/lib/booking-money";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import { formatINR } from "@/components/pages/services/services-columns";
import { whatsAppLink, toWhatsAppNumber } from "@/lib/whatsapp";
import { publicOrigin } from "@/lib/brand";
import {
  paymentRequestMessage,
  paymentConfirmedMessage,
} from "@/lib/payment-messages";
import createPaymentLink from "@/actions/appointments/create-payment-link";
import { BookingTermsSection } from "./booking-terms-section";
import { AddonsVisitSection } from "./visit-sections";
import { InvoiceSection } from "./invoice-section";

const DOT: Record<string, string> = {
  paid: "bg-emerald-600",
  due: "bg-amber-500",
  pending: "bg-muted-foreground/40",
};

/** One line of the totals ladder. */
function Row({
  label,
  value,
  muted,
  strong,
  className = "",
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between text-[12px] ${className}`}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={`font-mono tabular-nums ${strong ? "font-semibold" : ""} ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </span>
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
  const [takingPayment, setTakingPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const { mutate: update, isPending: isSaving } = useUpdateAppointment();
  const { lines, due, paid, totals } = bookingLedger(appointment);

  function markPaid() {
    const received = amount === "" ? appointment.quotedPrice : Number(amount);
    if (!(received && received > 0)) {
      toast.error("Enter the amount received");
      return;
    }
    update(
      {
        ...appointment,
        paymentReceived: true,
        paymentAmount: received,
        paymentMethod: (method ||
          undefined) as slotBookingZodType["paymentMethod"],
        paymentReceivedAt: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setTakingPayment(false);
          setAmount("");
          setMethod("");
        },
      },
    );
  }

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
      .map((l) => `${l.label} - ${formatINR(l.amount)}`)
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
                    {l.original && (
                      <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                        Save {formatINR(l.original - l.amount)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-right">
                  {l.original && (
                    <span className="block font-mono text-[11px] text-muted-foreground line-through tabular-nums">
                      {formatINR(l.original)}
                    </span>
                  )}
                  <span className="block font-mono text-[13px] font-semibold tabular-nums">
                    {formatINR(l.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="mt-2 space-y-1 border-t pt-2.5">
            {/* Only worth showing the arithmetic when something came off. */}
            {totals.discount > 0 && (
              <>
                <Row label="Subtotal" value={formatINR(totals.subtotal)} muted />
                <Row
                  label="Discount"
                  value={`- ${formatINR(totals.discount)}`}
                  className="text-emerald-600 dark:text-emerald-400"
                />
              </>
            )}
            {/* Only worth a line when it differs from what's due - otherwise
                it's the same number printed twice, which is the common case. */}
            {totals.total !== due && (
              <Row label="Total" value={formatINR(totals.total)} strong />
            )}
            {totals.paid > 0 && (
              <Row label="Paid" value={formatINR(totals.paid)} muted />
            )}

            <div className="flex items-baseline justify-between pt-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {due > 0 ? "Total due" : "Collected"}
              </span>
              <span
                className={`font-mono text-base font-bold tabular-nums ${
                  due > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600"
                }`}
              >
                {formatINR(due > 0 ? due : paid)}
              </span>
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
              {!appointment.paymentReceived && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTakingPayment((v) => !v)}
                >
                  Mark paid
                </Button>
              )}
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

        {/* Recording the booking payment - the one place money state changes. */}
        {takingPayment && (
          <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-2.5">
            <p className="text-[11px] font-medium">
              Record the payment for {bookingLabel(appointment)}
            </p>
            <div className="flex gap-1.5">
              <Input
                type="number"
                min={0}
                className="h-8"
                placeholder={String(appointment.quotedPrice ?? 0)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount received"
              />
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-8 w-32">
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
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                disabled={isSaving}
                onClick={markPaid}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </section>

      <AddonsVisitSection appointment={appointment} />
      <BookingTermsSection appointment={appointment} />
      <InvoiceSection appointmentId={appointment._id} />
    </div>
  );
}
