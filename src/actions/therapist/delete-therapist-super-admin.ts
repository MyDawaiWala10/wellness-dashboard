"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";

export default async function deleteTherapistSuperAdmin(
  id: string
): Promise<ApiResponse<any>> {
  const options: RequestInit = {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await fetchWithAuth(
      `${base_url}/api/therapist/super-delete/${id}`,
      options
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
      message: result.message || "Therapist deleted successfully",
    };
  } catch (err) {
    console.error("[deleteTherapistSuperAdmin]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
