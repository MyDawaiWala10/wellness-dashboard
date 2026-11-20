// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

export type Specialization = {
  _id?: string;
  value: string;
  label: string;
};

export async function getSpecializations(): Promise<ApiResponse<Specialization[]>> {
  return apiGet("specializations");
}
