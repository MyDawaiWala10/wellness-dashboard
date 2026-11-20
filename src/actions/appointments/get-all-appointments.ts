// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

/** Every booking this login may see; the server decides from the login, not the caller. */
export default async function getAllAppointments(): Promise<ApiResponse<any>> {
  return apiGet("appointments");
}
