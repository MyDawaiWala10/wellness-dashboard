import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import type { ApiResponse } from "@/type/api";

/**
 * One authed JSON call to the backend from a server action: the backend's
 * message on failure, a friendly one when it can't be reached.
 */
export async function backendCall<T>(path: string, init: RequestInit, label: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithAuth(`${base_url}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, message: result.message ?? `Request failed with status ${response.status}` };
    }
    return { success: true, message: result.message ?? "OK", data: result.data as T };
  } catch (err) {
    console.error(`[${label}]`, err);
    return { success: false, message: "Network error, please try again" };
  }
}
