/**
 * A full http(s) URL: the only kind of therapist profile link that is saved or
 * opened (never javascript: or data:). Mirrors the backend's parseProfileLink
 * (WellnessBackend lib/profileLink.ts) - KEEP IN SYNC.
 */
export function isProfileLink(value?: string | null): value is string {
  const v = value?.trim();
  if (!v || v.length > 500) return false;
  try {
    const { protocol } = new URL(v);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
