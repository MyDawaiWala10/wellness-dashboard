// The notification sound for new-enquiry notifications, plus a persisted mute
// preference. Everything here is best-effort: browsers block audio until the
// user has interacted with the page, so every path fails silently rather than
// throwing - a missed beep must never break the notification it accompanies.

const MUTE_KEY = "mdw:enquiry-sound-muted";

export function isEnquirySoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setEnquirySoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable (private mode / disabled) - preference just won't persist */
  }
}

// One reused element, created on the first play so nothing loads during SSR.
let audio: HTMLAudioElement | null = null;

/**
 * Play the new-enquiry notification sound, unless muted or the browser won't
 * allow audio yet. No-ops (silently) in every failure case.
 */
export function playEnquiryBeep(): void {
  if (isEnquirySoundMuted()) return;
  if (typeof window === "undefined") return;
  try {
    audio = audio ?? new Audio("/sounds/notification.mp3");
    audio.currentTime = 0;
    // Autoplay policy: play() rejects until the user has interacted with the
    // page - swallow it, by design.
    audio.play().catch(() => {});
  } catch {
    /* Audio unavailable - stay silent */
  }
}

const CLAIM_KEY = "mdw:alerted-bookings";
const CLAIM_MS = 10 * 60 * 1000;

/**
 * The beep for these new bookings, once across every open tab: the first tab to
 * see them claims them. ponytail: two tabs reading at the same instant can still
 * both beep; a Web Lock would close that if it ever matters.
 */
export function playEnquiryBeepOnce(keys: string[]): void {
  try {
    const now = Date.now();
    const claimed: Record<string, number> = JSON.parse(window.localStorage.getItem(CLAIM_KEY) || "{}");
    for (const k of Object.keys(claimed)) if (claimed[k] < now - CLAIM_MS) delete claimed[k];
    const fresh = keys.filter((k) => !claimed[k]);
    if (!fresh.length) return;
    for (const k of fresh) claimed[k] = now;
    window.localStorage.setItem(CLAIM_KEY, JSON.stringify(claimed));
  } catch {
    /* storage blocked: each tab beeps */
  }
  playEnquiryBeep();
}
