"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import type { ApiResponse } from "@/type/api";
import type { slotBookingZodType } from "@/type/schema";

/** Record money received (part or full). Returns the booking that holds the money. */
export default async function recordPayment(
  appointmentId: string,
  amount: number,
  method: string,
): Promise<ApiResponse<slotBookingZodType>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/appointments/${appointmentId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, message: result.message ?? `Request failed with status ${response.status}` };
    }
    return { success: true, message: result.message ?? "Payment recorded", data: result.data as slotBookingZodType };
  } catch (err) {
    console.error("[recordPayment]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
