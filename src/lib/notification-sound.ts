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
