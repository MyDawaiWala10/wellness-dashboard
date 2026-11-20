import type { NextRequest } from "next/server";
import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { AUTH_REFRESH_FAILED_CODE, AuthRefreshFailedError } from "@/lib/auth-errors";

/**
 * Read-only pass-through to the backend for the dashboard's data loading
 * (src/lib/api-get.ts). Server Actions run one at a time per browser
 * ("Next.js dispatches Server Actions one at a time per client"), so reads come
 * here as GETs, which run side by side; writes stay Server Actions.
 * Only these backend areas can be read, and the host is always the backend.
 */
const READABLE = new Set([
  "appointments", "customers", "clinic-settings", "session-rates", "services", "therapist",
  "therapist-leaves", "invoices", "offers", "payouts", "push", "specializations", "metrics", "users",
]);

/** The backend path for these URL segments, or null when it isn't readable here. */
export function backendReadPath(segments: string[]): string | null {
  if (!segments.length || !READABLE.has(segments[0])) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || /[/\\?#]/.test(s))) return null;
  return segments.map(encodeURIComponent).join("/");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const path = backendReadPath((await params).path);
  if (!path) return Response.json({ success: false, message: "Not found" }, { status: 404 });
  try {
    const res = await fetchWithAuth(`${base_url}/api/${path}${req.nextUrl.search}`, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    // Signed-in data: never cached by Vercel or the browser.
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthRefreshFailedError) {
      return Response.json({ success: false, message: error.message, code: AUTH_REFRESH_FAILED_CODE }, { status: 401 });
    }
    console.error("[api/backend]", path, error);
    return Response.json({ success: false, message: "Network error, please try again" }, { status: 502 });
  }
}
