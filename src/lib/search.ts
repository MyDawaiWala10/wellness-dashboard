/** A search box's text partly matches any of these fields (case-insensitive). Empty matches all. */
export function matchesSearch(query: unknown, fields: unknown[]): boolean {
  const q = String(query ?? "").trim().toLowerCase();
  return !q || fields.some((f) => f != null && String(f).toLowerCase().includes(q));
}
