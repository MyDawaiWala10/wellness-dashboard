// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

/** The server's public key; empty when phone alerts aren't set up there. */
export async function getPushKey(): Promise<ApiResponse<string>> {
  return apiGet("push/key");
}
