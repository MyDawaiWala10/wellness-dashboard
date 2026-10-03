import { bookingSource, bookingSourceMeta } from "@/lib/booking-source";
import { cn } from "@/lib/utils";

/**
 * The booking ID, as a pill coloured by how the booking reached us.
 * Single source of truth for how a booking ID looks - every table, drawer and
 * strip that shows ENQ-#### uses this, so the colours can't drift.
 *
 * The source label (and the referring therapist, when there is one) lives in
 * the tooltip, which keeps table rows as compact as the old plain ID.
 */
export function BookingIdBadge({
  record,
  className,
}: {
  record: {
    enquiryId?: string | null;
    source?: string | null;
    referredByName?: string | null;
  };
  className?: string;
}) {
  if (!record.enquiryId) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const source = bookingSource(record);
  const meta = bookingSourceMeta(source);
  const title =
    source === "therapist" && record.referredByName
      ? `${meta.label}: ${record.referredByName}`
      : meta.label;

  return (
    <span
      title={title}
      aria-label={`${record.enquiryId}, booked ${title}`}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      {record.enquiryId}
    </span>
  );
}
