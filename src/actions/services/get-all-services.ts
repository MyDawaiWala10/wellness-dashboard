"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { withAuthErrorHandling } from "@/lib/server-action-error";
import type { ApiResponse } from "@/type/api";
import type { ServiceType } from "@/type/schema";

export async function getAllServices(): Promise<ApiResponse<ServiceType[]>> {
  return withAuthErrorHandling(async () => {
    const response = await fetchWithAuth(`${base_url}/api/services`, {
      method: "GET",
      cache: "no-cache",
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? "Failed to fetch services",
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: "Services fetched successfully",
      data: result.data,
    };
  });
}
