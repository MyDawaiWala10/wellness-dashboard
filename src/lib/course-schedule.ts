/** The only course frequencies on offer (client list, B2 #10). */
export const SESSIONS_PER_WEEK = [1, 2, 3, 4] as const;

export function perWeekLabel(n: number): string {
  return n === 1 ? "Once a week" : n === 2 ? "Twice a week" : `${n} times a week`;
}

/**
 * Days from session 1 to session `n` (1-based), spread evenly through each
 * week: twice a week from a Tuesday is Tue, Fri, Tue, Fri; three times from a
 * Monday is Mon, Wed, Fri. Mirrors the backend's courseDayOffset
 * (lib/bookingService.ts) - KEEP IN SYNC.
 */
export function courseDayOffset(n: number, perWeek: number): number {
  const k = n - 1;
  return Math.floor(k / perWeek) * 7 + Math.floor(((k % perWeek) * 7) / perWeek);
}
