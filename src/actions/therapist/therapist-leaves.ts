"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";

export interface TherapistLeave {
  _id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function createTherapistLeave(data: {
  doctorId: string;
  startDate: string;
  endDate?: string;
  reason?: string;
}): Promise<{ success: boolean; data?: TherapistLeave; message?: string }> {
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/therapist-leaves`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? `Failed to create leave (HTTP ${response.status})`,
      };
    }
    const result = await response.json();
    return { success: true, data: result.data };
  } catch (e) {
    return {
      success: false,
      message: `Network error creating leave: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}

export async function deleteTherapistLeave(
  id: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/therapist-leaves/${id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? `Failed to delete leave (HTTP ${response.status})`,
      };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      message: `Network error deleting leave: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}

export async function updateWeekOffDays(
  doctorId: string,
  weekOffDays: number[],
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/therapist-leaves/week-off/${doctorId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOffDays }),
      },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? `Failed to update schedule (HTTP ${response.status})`,
      };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      message: `Network error updating schedule: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}
