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
  status: "ok" | "overlap" | "too-close";
  with?: { name: string; time: string };
};

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
  opts?: { excludeId?: string; defaultDurationMin?: number },
): ConflictResult {
  const defaultDuration = opts?.defaultDurationMin ?? 60;
  const candStart = toMinutes(candidate.startTime);
  if (Number.isNaN(candStart)) return { status: "ok" };
  const candEnd = candStart + candidate.durationMin;

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
  return null;
}
