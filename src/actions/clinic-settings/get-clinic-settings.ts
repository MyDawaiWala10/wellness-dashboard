"use server";
import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";

export type ClinicSettings = { bookingGapMinutes: number };

export default async function getClinicSettings(): Promise<ApiResponse<ClinicSettings>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/clinic-settings`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.error("[getClinicSettings] API error:", response.status, result.message ?? "No message");
      return { success: false, message: result.message ?? `Request failed with status ${response.status}` };
    }
    const result = await response.json();
    return { success: true, message: result.message ?? "OK", data: result.data as ClinicSettings };
  } catch (err) {
    console.error("[getClinicSettings]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
