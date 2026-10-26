import type { EnquiryType } from "@/type/schema";
import { toDayKey } from "@/components/pages/enquiries/booking";

/** "14:30" → 870 minutes-from-midnight; invalid → NaN. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type CandidateVisit = {
  doctorId: string;
  date: string; // "yyyy-MM-dd"
  startTime: string; // "HH:MM"
  durationMin: number;
};

export type ConflictResult = {
  // "after-hours": ends after 8:30 PM; "closed": today, from 8:30 PM;
  // "past": the start time has already gone for today.
  status: "ok" | "overlap" | "too-close" | "after-hours" | "closed" | "past";
  with?: { name: string; time: string };
};

// The day ends at 8:30 PM (B2 #7): visits finish by then, and from then on
// nothing more can be booked for today. Mirrors the backend's LAST_END_MIN
// (lib/bookingService.ts bookingTimeProblem), which refuses the same.
export const LAST_END_MIN = 20 * 60 + 30;

/** Now in India: today's "yyyy-MM-dd" and minutes since midnight. */
export function nowInIndia(now = new Date()): { day: string; min: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

/** The first day a visit can still be booked: today, or tomorrow from 8:30 PM. */
export function firstBookableDay(now = new Date()): string {
  const { day, min } = nowInIndia(now);
  if (min < LAST_END_MIN) return day;
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The reserved [startMin, endMin] of an existing appointment, or null. */
function spanOf(
  a: EnquiryType,
  defaultDurationMin: number,
): { startMin: number; endMin: number; time: string } | null {
  const start = a.therapyStartTime || a.physioSlot?.time || a.slot?.time;
  if (!start) return null;
  const startMin = toMinutes(start);
  if (Number.isNaN(startMin)) return null;
  const endRaw = a.therapyEndTime ? toMinutes(a.therapyEndTime) : NaN;
  const endMin =
    !Number.isNaN(endRaw) && endRaw > startMin
      ? endRaw
      : startMin + defaultDurationMin;
  return { startMin, endMin, time: start };
}

/**
 * Does a candidate visit collide with a therapist's existing bookings?
 *   overlap   - spans intersect (a therapist can't be in two places): hard.
 *   too-close - within `gapMinutes` edge-to-edge but not overlapping: soft-warn.
 * Overlap wins over too-close. Same doctor + same day only; cancelled and the
 * edited record are skipped.
 */
export function checkConflict(
  candidate: CandidateVisit,
  existing: EnquiryType[],
  gapMinutes: number,
  opts?: { excludeId?: string; defaultDurationMin?: number; now?: Date },
): ConflictResult {
  const defaultDuration = opts?.defaultDurationMin ?? 60;
  const candStart = toMinutes(candidate.startTime);
  if (Number.isNaN(candStart)) return { status: "ok" };
  const candEnd = candStart + candidate.durationMin;
  if (candEnd > LAST_END_MIN) return { status: "after-hours" };
  const india = nowInIndia(opts?.now);
  if (candidate.date === india.day) {
    if (india.min >= LAST_END_MIN) return { status: "closed" };
    // A slot that starts at or before "now" has already gone.
    if (candStart <= india.min) return { status: "past" };
  }

  let tooClose: ConflictResult | null = null;

  for (const e of existing) {
    if (e.status === "cancelled") continue;
    if (opts?.excludeId && e._id === opts.excludeId) continue;
    if (!e.doctorId || e.doctorId !== candidate.doctorId) continue;
    if (toDayKey(e.physioSlot?.date || e.slot?.date) !== candidate.date) continue;

    const span = spanOf(e, defaultDuration);
    if (!span) continue;

    // Overlap: intervals intersect.
    if (candStart < span.endMin && span.startMin < candEnd) {
      return { status: "overlap", with: { name: e.name ?? "a visit", time: span.time } };
    }
    // Otherwise measure the edge-to-edge gap.
    const gap =
      candEnd <= span.startMin
        ? span.startMin - candEnd
        : candStart - span.endMin;
    if (gap < gapMinutes && !tooClose) {
      tooClose = { status: "too-close", with: { name: e.name ?? "a visit", time: span.time } };
    }
  }

  return tooClose ?? { status: "ok" };
}

/**
 * Why a candidate visit can't be booked, or null when it can. An overlap and
 * leaving less than the booking gap are both hard blocks (client rule): only
 * cancelling the other visit frees the time. The server refuses the same.
 */
export function conflictMessage(
  conflict: ConflictResult,
  startTime: string,
  durationMin: number,
  gapMinutes: number,
): string | null {
  const other = `${conflict.with?.name ?? "another"}'s ${conflict.with?.time ?? ""} visit`;
  if (conflict.status === "overlap") {
    return `${durationMin} min from ${startTime} runs into ${other}. Pick another time.`;
  }
  if (conflict.status === "too-close") {
    return `${startTime} for ${durationMin} min leaves less than the ${gapMinutes}-min gap to ${other}. Pick another time.`;
  }
  if (conflict.status === "after-hours") {
    return `${durationMin} min from ${startTime} ends after 8:30 PM - visits must finish by then. Pick an earlier time.`;
  }
  if (conflict.status === "closed") {
    return "Bookings for today closed at 8:30 PM - pick tomorrow or later.";
  }
  if (conflict.status === "past") {
    return `${startTime} has already passed today - pick a later time.`;
  }
  return null;
}
