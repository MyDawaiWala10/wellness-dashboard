"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { withAuthErrorHandling } from "@/lib/server-action-error";
import type { ApiResponse } from "@/type/api";
import type { EnquiryType } from "@/type/schema";

export type CreateEnquiryInput = Pick<
  EnquiryType,
  "name" | "phonenumber" | "preferredReachOutTime" | "note" | "source" | "referredByDoctorId"
>;

export default async function createEnquiry(
  values: CreateEnquiryInput,
): Promise<ApiResponse<EnquiryType>> {
  return withAuthErrorHandling(async () => {
    const payload: Partial<EnquiryType> = {
      ...values,
      status: "enquiry",
      executiveReachedOut: false,
    };

    const response = await fetchWithAuth(`${base_url}/api/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
      message: result.message || "Enquiry created successfully",
      data: result.data,
    };
  });
}
