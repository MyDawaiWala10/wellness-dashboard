import { describe, it, expect } from "vitest";

import { buildEarningRows, canManageSplit, splitFor, therapistSplits } from "./earnings";
import type { slotBookingZodType } from "@/type/schema";

const splits = therapistSplits([
  { doctorId: "THR-1", splitPercent: 70 },
  { doctorId: "THR-2", splitPercent: null },
]);

describe("splitFor", () => {
  it("prefers the split locked in when the booking completed", () => {
    expect(splitFor({ doctorId: "THR-1", therapistSplitPercent: 60 }, splits)).toBe(60);
  });

  it("falls back to the therapist's current split", () => {
    expect(splitFor({ doctorId: "THR-1" }, splits)).toBe(70);
  });

  it("never guesses: no therapist, or no split set, gives null", () => {
    expect(splitFor({}, splits)).toBeNull();
    expect(splitFor({ doctorId: "THR-2" }, splits)).toBeNull();
    expect(splitFor({ doctorId: "THR-unknown" }, splits)).toBeNull();
  });
});

describe("buildEarningRows", () => {
  const booking = (over: Partial<slotBookingZodType>) =>
    ({ name: "x", phonenumber: 1, paymentAmount: 1000, ...over }) as slotBookingZodType;

  it("keeps a completed booking's cut when the therapist's split changes later", () => {
    const [row] = buildEarningRows(
      [booking({ doctorId: "THR-1", therapistSplitPercent: 60, status: "completed" })],
      splits, // THR-1 is now at 70%
    );
    expect(row.therapistCut).toBe(600);
    expect(row.companyCut).toBe(400);
  });

  it("pays no therapist cut when the split is unknown", () => {
    const [row] = buildEarningRows([booking({ doctorId: "THR-2" })], splits);
    expect(row.splitPercent).toBeNull();
    expect(row.therapistCut).toBe(0);
    expect(row.companyCut).toBe(1000);
  });
});

describe("canManageSplit", () => {
  it("is Admin / Super Admin only", () => {
    expect(canManageSplit("SUPER_ADMIN")).toBe(true);
    expect(canManageSplit("ADMIN")).toBe(true);
    expect(canManageSplit("THERAPIST")).toBe(false);
    expect(canManageSplit("STAFF")).toBe(false);
  });
});
