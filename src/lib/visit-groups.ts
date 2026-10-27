import type { slotBookingZodType } from "@/type/schema";
import { toDayKey } from "@/components/pages/enquiries/booking";
import { toMinutes } from "@/lib/booking-conflicts";
import { addonPaid } from "@/lib/booking-money";
import {
  courseSessionOf,
  getPackageProgressForAppointment,
  type PackageProgress,
} from "@/lib/package-progress";
import type { ServiceType } from "@/type/schema";

type Row = slotBookingZodType;

/**
 * Visits that belong to another booking: a later session of a recommended
 * add-on (addonOf) or a course follow-up (packageOriginId). They stay their own
 * records (each has its own date, code and completion), but the office sees
 * them inside their booking instead of as extra rows.
 */
export function parentIdOf(r: Row): string | undefined {
  if (r.addonOf?.bookingId) return r.addonOf.bookingId;
  return r.packageOriginId && r.packageOriginId !== r._id ? r.packageOriginId : undefined;
}

/** The list rows: every booking, without visits whose booking is also listed. */
export function topLevelRows(all: Row[]): Row[] {
  const ids = new Set(all.map((r) => r._id));
  return all.filter((r) => {
    const parent = parentIdOf(r);
    return !parent || !ids.has(parent);
  });
}

/** A booking's own later visits, soonest first. */
export function childVisitsOf(parent: Row, all: Row[]): Row[] {
  return all
    .filter((r) => parentIdOf(r) === parent._id)
    .sort((a, b) => visitStartMs(a) - visitStartMs(b));
}

/** When a visit starts (its own slot), in ms; Infinity when it has no date. */
export const visitStartMs = (r: Row) => {
  const day = toDayKey(r.slot?.date || r.physioSlot?.date);
  return day ? new Date(`${day}T${(r.slot?.time || r.physioSlot?.time || "00:00").padStart(5, "0")}:00`).getTime() : Infinity;
};

const isOpen = (r: Row) => r.status !== "completed" && r.status !== "cancelled";

/** The booking's next visit still to happen (itself or one of its visits). */
export function nextVisitOf(parent: Row, all: Row[]): Row | undefined {
  const today = toDayKey(new Date().toISOString());
  return [parent, ...childVisitsOf(parent, all)]
    .filter((r) => isOpen(r) && toDayKey(r.slot?.date || r.physioSlot?.date) >= today)
    .sort((a, b) => visitStartMs(a) - visitStartMs(b))[0];
}

/** "Sun, 18 Oct 2026 · 11:30-12:30 (60 min)" from a visit's own slot. */
export function visitWhen(r: Row): string {
  const day = toDayKey(r.slot?.date || r.physioSlot?.date);
  if (!day) return "No date yet";
  const date = new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const start = r.therapyStartTime || r.slot?.time || r.physioSlot?.time;
  const end = r.therapyEndTime;
  const length = start && end ? toMinutes(end) - toMinutes(start) : NaN;
  if (!start) return date;
  return end && length > 0 ? `${date} · ${start}-${end} (${length} min)` : `${date} · ${start}`;
}

/** What this visit is, e.g. "Accupunture - session 1 of 1" or "Session 3 of 9". */
export function visitLabel(r: Row, parent: Row): string {
  if (r.addonOf?.bookingId) {
    const rec = (parent.recommendedServices ?? []).find(
      (x) => `${x.serviceId}|${x.recommendedAt}` === r.addonOf!.key,
    );
    return `${r.service ?? "Add-on"} - session ${r.addonOf.session} of ${rec?.sessions ?? 1}`;
  }
  return `Session ${r.sessionNumber ?? "?"} of ${parent.totalSessions ?? "?"}`;
}

/**
 * A booking's course progress for the list ("1 of 3 completed"). A course with
 * a visit per session counts its completed visits (the booking is session 1);
 * a one-booking package uses its counter. null for single visits.
 */
export function courseProgressOf(r: Row, all: Row[], services: ServiceType[]): PackageProgress | null {
  const own = courseSessionOf(r);
  if (own && own.session === 1 && !parentIdOf(r)) {
    const completed = [r, ...childVisitsOf(r, all)].filter((v) => v.status === "completed").length;
    return {
      packageName: `${own.total}-session course`,
      packageServiceId: r.packageServiceId ?? "",
      total: own.total,
      completed,
      currentSession: Math.min(completed + 1, own.total),
      label: `${completed} of ${own.total} completed`,
      packageDone: completed >= own.total,
      split: true,
    };
  }
  return getPackageProgressForAppointment(r, all, services);
}

/** This visit's own price: its add-on session, or its share of the course. */
export function visitShare(r: Row, parent: Row): number {
  if (r.addonOf?.bookingId) {
    const rec = (parent.recommendedServices ?? []).find(
      (x) => `${x.serviceId}|${x.recommendedAt}` === r.addonOf!.key,
    );
    return rec ? Math.round(rec.quotedPrice / (rec.sessions ?? 1)) : 0;
  }
  return Math.round((parent.quotedPrice ?? 0) / (parent.totalSessions || 1));
}

/**
 * Still to collect for this visit (0 = covered): its own paced share. Mirrors
 * the backend's shortBeforeStart booking term (lib/payments.ts) - KEEP IN SYNC.
 * For a multi-session package this is ONE session's share, never the whole
 * package price - session N owes N/total cumulative minus what is already paid.
 */
export function visitShort(r: Row, parent: Row): number {
  if (r.addonOf?.bookingId) {
    const rec = (parent.recommendedServices ?? []).find(
      (x) => `${x.serviceId}|${x.recommendedAt}` === r.addonOf!.key,
    );
    if (!rec) return 0;
    const per = Math.round(rec.quotedPrice / (rec.sessions ?? 1));
    return Math.max(0, Math.min(rec.quotedPrice, per * r.addonOf.session) - addonPaid(rec));
  }
  // Mirror the backend's paidNeededBeforeVisit exactly: the current session comes
  // from the split-course position, else the completing row's counter - NOT
  // sessionNumber (which the completion flow repurposes as a moving pointer).
  const price = parent.quotedPrice ?? 0;
  const total = parent.totalSessions ?? 1;
  const session = courseSessionOf(r)?.session ?? (r.sessionsCompleted ?? 0) + 1;
  const needed = total <= 1 ? price : Math.min(price, Math.round((price / total) * session));
  return Math.max(0, needed - (parent.paymentAmount ?? 0));
}

/**
 * Unpaid same-visit add-ons (confirmed, not deferred to a later visit). Mirrors
 * the backend's unpaidAddonsThisVisit (lib/payments.ts) - KEEP IN SYNC. These
 * settle on the Billing tab, but the server still blocks completing the visit
 * until they are paid, so the visit's payment gate must count them too.
 */
export function visitAddonShort(r: Row): { amount: number; addons: string[] } {
  let amount = 0;
  const addons: string[] = [];
  for (const rec of r.recommendedServices ?? []) {
    if (rec.status !== "confirmed" || rec.firstInVisit === false) continue;
    const needed =
      (rec.sessions ?? 1) > 1 ? Math.round(rec.quotedPrice / (rec.sessions ?? 1)) : rec.quotedPrice;
    const short = Math.max(0, needed - addonPaid(rec));
    if (short > 0) {
      amount += short;
      addons.push(rec.serviceName);
    }
  }
  return { amount, addons };
}
