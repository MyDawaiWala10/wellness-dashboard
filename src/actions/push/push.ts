"use server";

/** Phone alerts: this browser's push subscription (WellnessBackend /api/push). */

import { backendCall } from "@/lib/backend-call";
import type { ApiResponse } from "@/type/api";

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** The server's public key; empty when phone alerts aren't set up there. */
export async function getPushKey(): Promise<ApiResponse<string>> {
  return backendCall("/api/push/key", { method: "GET" }, "getPushKey");
}

export async function savePushSubscription(sub: PushSubscriptionInput): Promise<ApiResponse<unknown>> {
  return backendCall("/api/push/subscriptions", { method: "POST", body: JSON.stringify(sub) }, "savePushSubscription");
}

export async function removePushSubscription(endpoint: string): Promise<ApiResponse<unknown>> {
  return backendCall("/api/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint }) }, "removePushSubscription");
}
