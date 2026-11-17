"use server";

import { backendCall } from "@/lib/backend-call";
import type { ApiResponse } from "@/type/api";
import type { PersistedCustomer } from "@/type/customer-record";

/** COD blacklist a customer (no cash), or allow cash again. The office only; the server checks. */
export async function setCustomerCodBlock(customerId: string, blocked: boolean): Promise<ApiResponse<PersistedCustomer>> {
  return backendCall(
    `/api/customers/${encodeURIComponent(customerId)}`,
    { method: "PATCH", body: JSON.stringify({ codBlocked: blocked }) },
    "setCustomerCodBlock",
  );
}
