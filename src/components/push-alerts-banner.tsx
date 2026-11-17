"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { OFFICE_ROLES } from "@/components/InboundBookingNotifier";
import { getPushKey } from "@/actions/push/push";
import { useAuthStore } from "@/providers/permission-provider";
import { enablePushAlerts, pushSupported, syncPushAlerts } from "@/lib/push-alerts";

// "Not now" lasts until the tab is closed, so it asks again another day.
const HIDE_KEY = "mdw:push-banner-hidden";

/**
 * Phone alerts (owner's rules, 2026-11-12): the office for every new enquiry
 * and booking, a therapist for bookings assigned to them. Asks once per
 * browser; once allowed it's invisible and keeps the device linked to whoever
 * is logged in.
 */
export function PushAlertsBanner() {
  const { user } = useAuthStore();
  const role = user?.role ?? "";
  const alerted = OFFICE_ROLES.has(role) || role === "THERAPIST";
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!alerted || !pushSupported()) return;
    if (Notification.permission === "granted") {
      void syncPushAlerts();
      return;
    }
    let hidden = false;
    try {
      hidden = sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      /* storage blocked: just ask */
    }
    if (Notification.permission !== "default" || hidden) return;
    // Only offer it when the server has alerts set up.
    let live = true;
    getPushKey().then((k) => live && setAsk(!!k.data));
    return () => {
      live = false;
    };
  }, [alerted, user?.id]);

  if (!ask) return null;

  async function turnOn() {
    setBusy(true);
    const result = await enablePushAlerts();
    setBusy(false);
    setAsk(false);
    if (result === "on") toast.success("Alerts are on for this device");
    else if (result === "blocked") toast.error("Alerts are blocked. Allow notifications for this site in Chrome's site settings.");
    else toast.error("Couldn't turn on alerts in this browser.");
  }

  function notNow() {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* storage blocked: hides for this page only */
    }
    setAsk(false);
  }

  return (
    <div role="region" aria-label="Booking alerts" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <BellRing className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        {role === "THERAPIST"
          ? "Get an alert on this device when a booking is assigned to you, even when the dashboard is closed."
          : "Get an alert on this device for every new enquiry and booking, even when the dashboard is closed."}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={notNow} disabled={busy}>
          Not now
        </Button>
        <Button type="button" size="sm" onClick={turnOn} disabled={busy}>
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Turn on
        </Button>
      </div>
    </div>
  );
}
