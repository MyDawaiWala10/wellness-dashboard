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
