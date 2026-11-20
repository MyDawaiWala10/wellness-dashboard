// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

/** One therapist's bookings (theirs and ones they worked on). */
export default async function getPersonalAppointments(id: string): Promise<ApiResponse<any>> {
  return apiGet(`therapist/${encodeURIComponent(id)}`);
}
