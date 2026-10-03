/**
 * How a booking reached us, and the colour its booking-ID pill wears.
 * The one place this mapping lives - the pill, the pickers and the drawer
 * editor all read from here.
 *
 * Must stay in step with BOOKING_SOURCES in the backend's lib/bookingSource.ts,
 * which is what actually validates the value on save.
 */
export const BOOKING_SOURCES = [
  {
    value: "online",
    label: "Online",
    // A black pill would vanish on the dark theme, so it inverts there.
    className: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
  },
  // Shades picked for WCAG AA with white 11px text (4.5:1). The lighter
  // green-600 / orange-500 look closer to "WhatsApp green" but fail at 3.3:1
  // and 2.8:1, so the ID becomes hard to read.
  { value: "whatsapp", label: "WhatsApp", className: "bg-green-700 text-white" },
  { value: "walk_in", label: "Walk-in", className: "bg-blue-600 text-white" },
  { value: "therapist", label: "Via Therapist", className: "bg-orange-700 text-white" },
] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number]["value"];

/**
 * The source to show for a booking. Older rows predate the field:
 * website bookings ("public_booking_form") read as Online, and anything
 * staff typed in ("dashboard", or nothing at all) reads as WhatsApp, which is
 * how the client asked for historical bookings to be treated.
 */
export function bookingSource(record: { source?: string | null }): BookingSource {
  const s = record.source;
  if (BOOKING_SOURCES.some((b) => b.value === s)) return s as BookingSource;
  if (s === "public_booking_form") return "online";
  return "whatsapp";
}

export function bookingSourceMeta(source: BookingSource) {
  return BOOKING_SOURCES.find((b) => b.value === source) ?? BOOKING_SOURCES[1];
}

export type BookingSourceValue = {
  source?: BookingSource | "";
  referredByDoctorId?: string | null;
};

/**
 * Why this pick can't be saved yet, or undefined when it's complete. Every
 * form validates through this, so the "therapist needs a referrer" rule lives
 * in one place. The backend re-checks it (lib/bookingSource.ts).
 */
export function bookingSourceError(value: BookingSourceValue): string | undefined {
  if (!value.source) return "Pick how this booking reached us.";
  if (value.source === "therapist" && !value.referredByDoctorId) {
    return "Pick the therapist who referred them.";
  }
  return undefined;
}
