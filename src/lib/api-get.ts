import type { ApiResponse } from "@/type/api";

/**
 * Read from the backend through the dashboard's GET route (app/api/backend).
 * Unlike Server Actions these run side by side and can be cancelled, so a page's
 * reads don't queue behind each other or behind a click. Same result shape as
 * the old read actions; a session that can't be refreshed keeps its `code`.
 */
export async function apiGet<T>(path: string, init?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`/api/backend/${path.replace(/^\/+/, "")}`, {
      signal: init?.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: body.message ?? `Request failed with status ${res.status}`,
        ...(body.code ? { code: body.code } : {}),
      };
    }
    return { success: true, message: body.message ?? "OK", data: body.data as T };
  } catch (error) {
    // A cancelled read (React Query stopped needing it) isn't a failure to show.
    if ((error as Error)?.name === "AbortError") throw error;
    return { success: false, message: "Network error, please try again" };
  }
}
