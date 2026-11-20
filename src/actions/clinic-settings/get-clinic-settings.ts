// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

export type ClinicSettings = { bookingGapMinutes: number };

export default async function getClinicSettings(): Promise<ApiResponse<ClinicSettings>> {
  return apiGet("clinic-settings");
}
