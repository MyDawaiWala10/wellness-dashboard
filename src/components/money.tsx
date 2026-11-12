"use client";

import { cn } from "@/lib/utils";
import { formatINR } from "@/components/pages/services/services-columns";

/**
 * Single source of truth for money on screen.
 *
 * One font family (the app's Geist Sans) with `tabular-nums` so digits are
 * equal-width and columns line up — the same treatment the customer-facing
 * pay page uses. We deliberately do NOT use `font-mono` for currency; that
 * typeface is reserved for IDs (booking / therapist / VPA) where monospace
 * genuinely helps scanning. Route every ₹ figure through this so the billing
 * tab, the booking invoice and the pay page can never drift apart again.
 */
export function Money({
  value,
  prefix,
  struck,
  className,
}: {
  value: number;
  /** Symbol shown before the amount, e.g. "+" or "−". */
  prefix?: string;
  /** Render as a muted, struck-through "was" price. */
  struck?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        struck && "text-muted-foreground line-through",
        className,
      )}
    >
      {prefix ? `${prefix} ` : ""}
      {formatINR(value)}
    </span>
  );
}

/**
 * A per-session price from the rate card: the standard 1-session rate crossed
 * out in front when this one is lower ("₹1,600 ₹1,500/session"). The invoice
 * shows the same (WellnessBackend lib/invoiceView.ts listPrice).
 */
export function PerSession({ rate, standard }: { rate: number; standard?: number }) {
  return (
    <span className="whitespace-nowrap">
      {standard != null && standard > rate && <Money value={standard} struck className="mr-1" />}
      <Money value={rate} />
      /session
    </span>
  );
}
