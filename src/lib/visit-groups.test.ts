import { describe, it, expect } from "vitest";
import type { slotBookingZodType } from "@/type/schema";
import { childVisitsOf, courseProgressOf, nextVisitOf, topLevelRows, visitAddonShort, visitShort } from "./visit-groups";

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

// Mirrors the backend's shortBeforeStart / unpaidAddonsThisVisit / paidNeededBeforeVisit
// (WellnessBackend lib/payments.ts). These numbers MUST track the backend tests
// (payments.realdoc.test.ts, addonVisits.test.ts) - KEEP IN SYNC. This whole block
// is the tripwire for the "collect the whole package at session 1" regression.
describe("visit payment gate (paced) - FE/BE parity", () => {
  it("session 1 of a multi-session package collects ONE share, not the whole price", () => {
    const pkg = row({ _id: "c1", bookingKind: "course", totalSessions: 3, sessionIntervalDays: 7, quotedPrice: 4800, paymentAmount: 0, status: "scheduled" });
    expect(visitShort(pkg, pkg)).toBe(1600); // 4800/3, NOT 4800
  });

  it("a follow-up session owes its cumulative share minus what's already paid", () => {
    const origin = row({ _id: "c", bookingKind: "course", totalSessions: 3, sessionIntervalDays: 7, quotedPrice: 4800, paymentAmount: 1600 });
    const s2 = row({ _id: "s2", packageOriginId: "c", sessionNumber: 2, totalSessions: 3, status: "scheduled" });
    expect(visitShort(s2, origin)).toBe(1600); // 3200 needed - 1600 paid
  });

  it("a one-row package paces by the sessionsCompleted counter (not sessionNumber)", () => {
    const c = row({ _id: "k", totalSessions: 5, quotedPrice: 3000, sessionsCompleted: 2, status: "ongoing" });
    expect(visitShort(c, c)).toBe(1800); // 3/5 of 3000, nothing paid
  });

  it("a single visit owes its full remaining fee", () => {
    const v = row({ _id: "s", quotedPrice: 1200, paymentAmount: 500 });
    expect(visitShort(v, v)).toBe(700);
  });

  it("same-visit unpaid add-ons count toward the gate, while the settled booking share is 0", () => {
    const p = row({ _id: "p", quotedPrice: 1600, paymentAmount: 1600, recommendedServices: [
      { serviceId: "A", recommendedAt: "t", serviceName: "Cupping", quotedPrice: 500, sessions: 1, status: "confirmed", firstInVisit: true, paidAmount: 0 },
    ] });
    expect(visitShort(p, p)).toBe(0);
    expect(visitAddonShort(p).amount).toBe(500);
  });

  it("an add-on deferred to a later visit does not gate this one", () => {
    const p = row({ _id: "p2", quotedPrice: 1600, paymentAmount: 1600, recommendedServices: [
      { serviceId: "B", recommendedAt: "t", serviceName: "Dry Needling", quotedPrice: 400, sessions: 1, status: "confirmed", firstInVisit: false, paidAmount: 0 },
    ] });
    expect(visitAddonShort(p).amount).toBe(0);
  });

  it("a multi-session add-on done in this visit counts just this session's share", () => {
    const p = row({ _id: "p3", quotedPrice: 1600, paymentAmount: 1600, recommendedServices: [
      { serviceId: "C", recommendedAt: "t", serviceName: "Massage", quotedPrice: 800, sessions: 2, status: "confirmed", firstInVisit: true, paidAmount: 0 },
    ] });
    expect(visitAddonShort(p).amount).toBe(400); // 800/2
  });
});
