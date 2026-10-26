import type { EnquiryType, ServiceType } from "@/type/schema";

/**
 * The booking an executive confirms at step 3 of the client-approved funnel:
 * an online consultation, or a home visit.
 *
 * This rides on the EXISTING `typeOfappointment` field rather than a new one -
 * the backend model is strict, so an unknown field would be silently dropped on
 * save. The two enum values map 1:1 onto the two choices, so nothing is lost.
 */
export type BookingType = NonNullable<EnquiryType["typeOfappointment"]>;

export const BOOKING_TYPES: {
  value: BookingType;
  label: string;
  /** Services-catalogue entry this booking is priced from. */
  serviceName: string;
}[] = [
  {
    value: "consultation",
    label: "Online consultation",
    serviceName: "Online Consultation",
  },
  {
    value: "appointment",
    label: "Home visit",
    serviceName: "Home Visit Consultation",
  },
];

/**
 * What was sold: a one-off intake (the diagnostic front door - an online
 * consultation or a home visit), or a course of therapy sessions bought after it.
 */
export type BookingKind = "intake" | "course";

/**
 * The kind of a booking record.
 *
 * Prefers the stored field, and otherwise derives it from the session count, so
 * records written before the field existed still read correctly. An intake sells
 * no session course; a course sells at least one. Delivery mode deliberately
 * plays no part - a course is always at home, which is exactly why the mode
 * alone cannot separate a Home Visit intake from a course of home sessions.
 */
export function bookingKindOf(record: {
  bookingKind?: BookingKind;
  totalSessions?: number;
}): BookingKind {
  if (record.bookingKind) return record.bookingKind;
  return (record.totalSessions ?? 0) >= 1 ? "course" : "intake";
}

/**
 * Label for a booking, correct for both kinds: a course is always home-delivered
 * therapy, so it is never labelled with an intake type.
 */
export function bookingLabel(record: {
  bookingKind?: BookingKind;
  totalSessions?: number;
  typeOfappointment?: BookingType;
}): string {
  if (bookingKindOf(record) === "course") {
    const n = record.totalSessions ?? 0;
    return n > 1 ? `Therapy package (${n} sessions)` : "Therapy session";
  }
  return bookingTypeLabel(record.typeOfappointment) ?? "Consultation";
}

/**
 * Label for a confirmed intake type.
 *
 * Only meaningful for intake records. Use `bookingLabel` when the record could
 * be either kind - it routes courses away from these two labels.
 */
export function bookingTypeLabel(t: BookingType | undefined): string | undefined {
  return BOOKING_TYPES.find((b) => b.value === t)?.label;
}

/**
 * The catalogue fee for a booking type, or `undefined` when the executive
 * hasn't put that service on the Services page yet.
 *
 * Undefined is surfaced as a prompt to go add it - never silently priced at 0,
 * because an unpriced record generates no invoice at all.
 */
export function catalogueFee(
  t: BookingType,
  services: ServiceType[],
): number | undefined {
  const wanted = BOOKING_TYPES.find((b) => b.value === t)?.serviceName;
  if (!wanted) return undefined;
  const match = services.find(
    (s) => s.name?.trim().toLowerCase() === wanted.toLowerCase(),
  );
  return match?.originalPrice;
}

/**
 * Normalise a slot date to a comparable "yyyy-MM-dd" key.
 *
 * `slot.date` is a Date in the backend model, so it arrives as a full ISO
 * string, while the date picker produces "yyyy-MM-dd". Comparing the two raw
 * would never match - every slot would look free.
 */
export function toDayKey(d: string | undefined): string {
  if (!d) return "";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}

/**
 * Map a client-site `service` offering to the booking type it implies, for
 * auto-selecting step 3. Conservative: only the unambiguous "Online
 * Consultation" seeds; Home Therapy / Vitals / anything else is left for the
 * executive to pick.
 */
export function bookingTypeFromService(
  service: string | undefined,
): BookingType | undefined {
  if (service === "Online Consultation") return "consultation";
  return undefined;
}
