import { describe, it, expect } from "vitest";
import type { slotBookingZodType } from "@/type/schema";
import { childVisitsOf, nextVisitOf, topLevelRows, visitShort } from "./visit-groups";

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
