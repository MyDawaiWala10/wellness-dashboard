"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import type { ApiResponse } from "@/type/api";
import type { slotBookingZodType } from "@/type/schema";

export type AddRecommendationInput = {
  serviceId: string;
  serviceName: string;
  category?: string;
  quotedPrice: number;
  sessions?: number;
  slot?: { date: string; time: string };
  durationMin?: number;
  intervalDays?: number;
};

export default async function addAppointmentRecommendation(
  appointmentId: string,
  values: AddRecommendationInput,
): Promise<ApiResponse<slotBookingZodType>> {
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/appointments/${appointmentId}/recommendations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

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
      message: result.message ?? "Recommendation added",
      data: result.data as slotBookingZodType,
    };
  } catch (err) {
    console.error("[addAppointmentRecommendation]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
