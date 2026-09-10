"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { withAuthErrorHandling } from "@/lib/server-action-error";
import type { ApiResponse } from "@/type/api";

export default async function getAnalyticsData(): Promise<ApiResponse<any>> {
  return withAuthErrorHandling(async () => {
    const response = await fetchWithAuth(`${base_url}/api/metrics`, {
      method: "GET",
      headers: { accept: "application/json" },
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
      message: result.message || "Data fetched successfully",
      data: result.data,
    };
  });
}