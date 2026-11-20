// Phone alerts (web push) for this browser: turn on, keep in step, turn off at
// logout. The service worker that shows them is public/sw.js; who gets which
// alert is decided by the backend (lib/push.ts).

import { removePushSubscription, savePushSubscription } from "@/actions/push/push";
import { getPushKey } from "@/actions/push/get-push-key";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The server's base64url key as the bytes the browser wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

/** Subscribe this browser and tell the server it's this user's. False: alerts aren't set up. */
async function subscribe(): Promise<boolean> {
  const key = await getPushKey();
  if (!key.success || !key.data) return false;
  const serverKey = keyBytes(key.data);
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // One made with an older server key can't receive any more.
  if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return false;
  return (await savePushSubscription({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } })).success;
}

/** The "Turn on" tap: ask permission, then subscribe. */
export async function enablePushAlerts(): Promise<"on" | "blocked" | "unavailable"> {
  if (!pushSupported()) return "unavailable";
  if ((await Notification.requestPermission()) !== "granted") return "blocked";
  try {
    return (await subscribe()) ? "on" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Every visit, once allowed: re-links the device to whoever is logged in now. */
export async function syncPushAlerts(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  await subscribe().catch(() => {});
}

/** Logout: this browser stops getting this user's alerts. */
export async function disablePushAlerts(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (!sub) return;
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* best effort: logout must still happen */
  }
}
