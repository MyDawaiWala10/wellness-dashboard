// A person's gender and age, as the backend keeps them (WellnessBackend
// lib/personDetails.ts): age is a birth year, or an exact date of birth from
// the customer app, so it never goes stale.

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

/** "female" → "Female"; nothing → "". */
export function genderLabel(g?: string | null): string {
  return g ? g[0].toUpperCase() + g.slice(1) : "";
}

/** Current age: exact from the date of birth, else from the birth year. */
export function personAge(
  p: { dob?: string | null; birthYear?: number | null } | null | undefined,
  today = new Date(),
): number | undefined {
  if (p?.dob) {
    const dob = new Date(p.dob);
    const years = today.getFullYear() - dob.getFullYear();
    const beforeBirthday =
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
    return beforeBirthday ? years - 1 : years;
  }
  if (p?.birthYear) return today.getFullYear() - p.birthYear;
  return undefined;
}
