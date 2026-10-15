"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";
import { slotBookingZodType } from "@/type/schema";

export default async function updateAppointment(values: slotBookingZodType): Promise<ApiResponse<any>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/appointments/${values._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? `Request failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Appointment updated successfully",
      // The saved booking as the server stored it (price, payments, etc.).
      data: result.data,
    };
  } catch (err) {
    console.error("[updateAppointment]", err);
    return { success: false, message: "Network error, please try again" };
  }
}