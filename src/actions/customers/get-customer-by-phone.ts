// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";
import type { PersistedCustomer } from "@/type/customer-record";

export async function getCustomerByPhone(phone: number): Promise<ApiResponse<PersistedCustomer[]>> {
  const res = await apiGet<PersistedCustomer[]>(`customers?q=${encodeURIComponent(String(phone))}`);
  return res.success ? { ...res, data: res.data ?? [] } : res;
}
