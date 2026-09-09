"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";
import { TherapistformType } from "@/type/schema";

export default async function updateTherapistSuperAdmin(
  values: TherapistformType
): Promise<ApiResponse<any>> {
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/therapist/super-update/${values.doctorId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message:
          result.message ?? `Request failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Therapist updated successfully",
    };
  } catch (err) {
    console.error("[updateTherapistSuperAdmin]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
