import { describe, it, expect } from "vitest";
import type { slotBookingZodType } from "@/type/schema";
import { childVisitsOf, courseProgressOf, nextVisitOf, topLevelRows, visitShort } from "./visit-groups";

const row = (over: Partial<slotBookingZodType>) =>
  ({ name: "A", phonenumber: 9999999999, ...over }) as slotBookingZodType;

const parent = row({
  _id: "p",
  status: "completed",
  quotedPrice: 1600,
  paymentAmount: 1600,
  recommendedServices: [
    { serviceId: "S", recommendedAt: "t", serviceName: "Accupunture", quotedPrice: 500, status: "confirmed", sessions: 1, paidAmount: 0 },
  ],
});
const addonVisit = row({
  _id: "v",
  status: "scheduled",
  service: "Accupunture",
  slot: { date: "2099-10-18", time: "11:30" },
  addonOf: { bookingId: "p", key: "S|t", session: 1 },
});
const orphan = row({ _id: "o", addonOf: { bookingId: "missing", key: "x", session: 1 } });

describe("visit groups", () => {
  it("hides a visit inside its booking, but never loses one whose booking isn't listed", () => {
    expect(topLevelRows([parent, addonVisit, orphan]).map((r) => r._id)).toEqual(["p", "o"]);
  });

  it("finds a booking's visits and its next one", () => {
    expect(childVisitsOf(parent, [parent, addonVisit]).map((r) => r._id)).toEqual(["v"]);
    expect(nextVisitOf(parent, [parent, addonVisit])?._id).toBe("v");
  });

  it("an unpaid add-on visit needs its share before it starts", () => {
    expect(visitShort(addonVisit, parent)).toBe(500);
  });
});

describe("Sessions column", () => {
  it("a course with a visit per session counts its completed visits", () => {
    const origin = row({ _id: "c", bookingKind: "course", totalSessions: 3, sessionIntervalDays: 7, status: "completed" });
    const s2 = row({ _id: "s2", packageOriginId: "c", sessionNumber: 2, totalSessions: 3, status: "scheduled" });
    const s3 = row({ _id: "s3", packageOriginId: "c", sessionNumber: 3, totalSessions: 3, status: "scheduled" });
    expect(courseProgressOf(origin, [origin, s2, s3], [])?.label).toBe("1 of 3 completed");
  });

  it("a single visit has nothing to count", () => {
    expect(courseProgressOf(row({ _id: "x", status: "completed" }), [], [])).toBeNull();
  });
});
