"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";

export type ReferredBooking = {
  _id: string;
  enquiryId?: string;
  name: string;
  service?: string;
  status?: string;
  paymentReceived?: boolean;
  createdAt?: string;
};

/** Bookings that came in through this therapist's referral code. */
export default async function getReferrals(doctorId: string): Promise<ApiResponse<ReferredBooking[]>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/therapist/${doctorId}/referrals`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-cache",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, message: result.message ?? `Request failed with status ${response.status}` };
    }
    return { success: true, message: "ok", data: result.data ?? [] };
  } catch (error) {
    console.error("[get-referrals]", error);
    return { success: false, message: "Network error, please try again" };
  }
}
