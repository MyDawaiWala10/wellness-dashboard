// Phone alerts for new enquiries and bookings, sent by the backend (lib/push.ts).
// No fetch handler on purpose: the dashboard is always live, nothing is cached.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const alert = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      // A dashboard on screen already rings with its own alert: no double ding.
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (open.some((c) => c.visibilityState === "visible")) return;
      await self.registration.showNotification(alert.title || "MDW Wellness", {
        body: alert.body || "",
        tag: alert.tag,
        renotify: Boolean(alert.tag),
        // Stays until someone taps it, so a busy morning can't hide a lead.
        requireInteraction: true,
        vibrate: [300, 100, 300],
        data: { url: alert.url || "/dashboard" },
      });
    })(),
  );
});

// Tapping it opens the dashboard on the right page, reusing an open tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const tab = open[0];
      if (!tab) return self.clients.openWindow(url);
      await tab.focus();
      await tab.navigate(url).catch(() => {});
    })(),
  );
});
