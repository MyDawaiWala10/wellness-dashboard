import type { slotBookingZodType } from "@/type/schema";
import { bookingLabel } from "@/components/pages/enquiries/booking";

export type LedgerLine = {
  key: string;
  label: string;
  meta: string;
  amount: number;
  /**
   * What the line would have cost before a discount, when one was given.
   * Only ever set on the booking line: add-ons carry a single quotedPrice with
   * no original/discount fields on the model, so there's nothing to compare.
   */
  original?: number;
  /** paid | due | awaiting the customer's confirmation */
  state: "paid" | "due" | "pending";
};

export type LedgerTotals = {
  /** Sum of list prices, using each line's original where one exists. */
  subtotal: number;
  /** How much came off the subtotal. Zero when nothing was discounted. */
  discount: number;
  /** What the customer is actually being charged, before payment. */
  total: number;
  paid: number;
  due: number;
};

/**
 * Everything sold on this booking, as one list with a running total.
 *
 * The booking fee and its add-ons used to be shown in two different places (and
 * the add-ons twice over), so nobody could answer "what does this customer
 * actually owe?" without adding it up by hand. One list, one total, one place.
 */
export function bookingLedger(a: slotBookingZodType): {
  lines: LedgerLine[];
  due: number;
  paid: number;
  totals: LedgerTotals;
} {
  const lines: LedgerLine[] = [];

  const fee = a.quotedPrice ?? 0;
  if (fee > 0) {
    // Only treat it as a discount when the "before" price is genuinely higher.
    // originalPrice gets filled in on plenty of bookings that were never
    // discounted, so comparing is safer than trusting the field's presence.
    const listed = a.originalPrice ?? 0;
    const original = listed > fee ? listed : undefined;
    // Part-paid: the paid share and the balance as two lines (mirrors the
    // backend's lib/bookingMoney.ts).
    const paid = a.paymentReceived ? fee : Math.min(fee, Math.max(0, a.paymentAmount ?? 0));
    const label = bookingLabel(a);
    if (paid > 0) {
      lines.push({
        key: "booking-paid",
        label,
        meta: paid < fee ? "Paid so far" : "Paid",
        amount: paid,
        original: paid >= fee ? original : undefined,
        state: "paid",
      });
    }
    if (paid < fee) {
      lines.push({
        key: "booking",
        label: paid > 0 ? `${label} - balance` : label,
        meta: "Unpaid",
        amount: fee - paid,
        original: paid > 0 ? undefined : original,
        state: "due",
      });
    }
  }

  for (const r of a.recommendedServices ?? []) {
    const confirmed = r.status === "confirmed";
    lines.push({
      key: `${r.serviceId}-${r.recommendedAt}`,
      label: r.serviceName,
      meta: !confirmed
        ? "Awaiting customer"
        : r.paymentCollected
          ? "Paid"
          : "Confirmed - unpaid",
      amount: r.quotedPrice ?? 0,
      state: !confirmed ? "pending" : r.paymentCollected ? "paid" : "due",
    });
  }

  const sum = (s: LedgerLine["state"]) =>
    lines.filter((l) => l.state === s).reduce((t, l) => t + l.amount, 0);

  const paid = sum("paid");
  const due = sum("due");

  // The ladder covers everything on the booking, pending add-ons included, so
  // "Total" answers "what is this booking worth" rather than "what is owed
  // right now" - that's what Due is for, and the two differ whenever an add-on
  // is still awaiting the customer.
  const total = lines.reduce((t, l) => t + l.amount, 0);
  const subtotal = lines.reduce((t, l) => t + (l.original ?? l.amount), 0);

  // "Pending" add-ons are not owed yet - the customer hasn't agreed to them.
  return {
    lines,
    due,
    paid,
    totals: { subtotal, discount: subtotal - total, total, paid, due },
  };
}
