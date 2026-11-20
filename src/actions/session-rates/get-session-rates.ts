// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";
import type { SessionRateTier } from "@/type/schema";

export type SessionRateCard = { tiers: SessionRateTier[] };

export default async function getSessionRates(): Promise<ApiResponse<SessionRateCard>> {
  return apiGet("session-rates");
}
