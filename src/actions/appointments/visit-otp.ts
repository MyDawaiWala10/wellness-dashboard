"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";

/** Generate + store a fresh visit OTP; returns the code so the exec can send it via wa.me. */
export async function sendVisitOtp(id: string) {
  const res = await fetchWithAuth(`${base_url}/api/appointments/${id}/visit-otp/send`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  return {
    success: res.ok,
    code: body?.code as string | undefined,
    message: body?.message as string | undefined,
  };
}

/** Verify the code the customer read back; marks the visit verified server-side. */
export async function verifyVisitOtp(id: string, code: string) {
  const res = await fetchWithAuth(`${base_url}/api/appointments/${id}/visit-otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = await res.json().catch(() => ({}));
  // short: least to collect before this session can start (402).
  return {
    success: res.ok,
    message: body?.message as string | undefined,
    short: typeof body?.short === "number" ? (body.short as number) : undefined,
    // due: everything still owed on the booking (the most that can be paid now).
    due: typeof body?.due === "number" ? (body.due as number) : undefined,
  };
}
