// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";
import type { PersistedCustomer } from "@/type/customer-record";

export async function getCustomers(q?: string): Promise<ApiResponse<PersistedCustomer[]>> {
  const res = await apiGet<PersistedCustomer[]>(q ? `customers?q=${encodeURIComponent(q)}` : "customers");
  return res.success ? { ...res, data: res.data ?? [] } : res;
}
