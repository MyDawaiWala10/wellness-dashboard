import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fetchwithauth", () => ({ fetchWithAuth: vi.fn() }));

import { apiGet } from "./api-get";
import { backendReadPath } from "@/app/api/backend/[...path]/route";

afterEach(() => vi.unstubAllGlobals());

describe("backendReadPath: only backend reads, never another host or path trick", () => {
  it("allows the dashboard's read areas", () => {
    expect(backendReadPath(["appointments"])).toBe("appointments");
    expect(backendReadPath(["appointments", "version"])).toBe("appointments/version");
    expect(backendReadPath(["therapist", "THR-0004", "referrals"])).toBe("therapist/THR-0004/referrals");
    expect(backendReadPath(["users", "getallusers"])).toBe("users/getallusers");
  });

  it.each([
    [[]],
    [["admin"]],
    [["appointments", ".."]],
    [["appointments", "..", "users"]],
    [["appointments", "a/b"]],
    [["appointments", "x?y=1"]],
    [["https:", "", "evil.com"]],
  ])("refuses %j", (segments) => expect(backendReadPath(segments)).toBeNull());
});

describe("apiGet: same result shape as the old read actions", () => {
  const reply = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it("success carries the data, through the dashboard's own route", async () => {
    reply(200, { success: true, message: "OK", data: [1, 2] });
    expect(await apiGet<number[]>("appointments")).toEqual({ success: true, message: "OK", data: [1, 2] });
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/backend/appointments");
  });

  it("an expired session keeps its code, so the login prompt still shows", async () => {
    reply(401, { success: false, message: "Session expired. Please log in again.", code: "AUTH_REFRESH_FAILED" });
    expect(await apiGet("appointments")).toEqual({ success: false, message: "Session expired. Please log in again.", code: "AUTH_REFRESH_FAILED" });
  });

  it("a cancelled read is left to React Query; a dead network is a plain failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }));
    await expect(apiGet("appointments")).rejects.toThrow("aborted");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await apiGet("appointments")).toEqual({ success: false, message: "Network error, please try again" });
  });
});
