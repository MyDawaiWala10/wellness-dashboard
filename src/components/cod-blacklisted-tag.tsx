import { Badge } from "@/components/ui/badge";

/**
 * "COD BLACKLISTED": no cash from this customer (backend lib/codBlock.ts).
 * The one look for it, on the customer and on each of their bookings.
 */
export function CodBlacklistedTag({ record }: { record?: { codBlocked?: boolean } | null }) {
  if (!record?.codBlocked) return null;
  return (
    <Badge
      variant="outline"
      title="No cash from this customer: take UPI, card or a payment link"
      className="whitespace-nowrap border-red-600 bg-red-50 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-500 dark:bg-red-950/60 dark:text-red-300"
    >
      COD blacklisted
    </Badge>
  );
}
