// Bookings created in this tab, so the new-booking alert doesn't ping the person
// who just made one. A package's later sessions point at session 1, so marking
// session 1 covers them too.
// ponytail: per tab and in memory; another tab or device of the same person
// still alerts. Upgrade path: a createdBy field on the booking.

const own = new Set<string>();

export function markOwnBooking(record?: { _id?: string } | null): void {
  if (record?._id) own.add(record._id);
}

export function isOwnBooking(id?: string): boolean {
  return !!id && own.has(id);
}

/**
 * Newly seen records as bookings: a package's sessions arrive together and are
 * one booking ("+N visits"); bookings this tab created are dropped.
 */
export function newBookingsOf<T extends { _id?: string }>(
  fresh: T[],
  parentOf: (r: T) => string | undefined,
): { rec: T; visits: number }[] {
  const ids = new Set(fresh.map((r) => r._id));
  return fresh
    .filter((r) => !ids.has(parentOf(r) ?? ""))
    .filter((r) => !isOwnBooking(r._id) && !isOwnBooking(parentOf(r)))
    .map((rec) => ({ rec, visits: fresh.filter((r) => parentOf(r) === rec._id).length }));
}
