import { describe, it, expect } from "vitest";

import {
  buildEarningRows,
  canManageSplit,
  computeEarningsSummary,
  isUpcoming,
} from "./earnings";
import type { PayoutPart, slotBookingZodType } from "@/type/schema";

const bucket = (revenue = 0, therapistCut = 0, extra: { discount?: number; due?: number } = {}) => ({
  revenue,
  therapistCut,
  companyCut: revenue - therapistCut,
  discount: extra.discount ?? 0,
  due: extra.due ?? 0,
});

/** One session done and paid for at 70%, nothing paid out yet. */
const part = (over: Partial<PayoutPart> = {}): PayoutPart => ({
  doctorId: "THR-1",
  doctor: "Asha",
  splitPercent: 70,
  sessions: 1,
  earned: bucket(1000, 700),
  pending: { ...bucket(), due: 0 },
  upcoming: bucket(),
  paidOut: 0,
  owed: 700,
  ...over,
});

const booking = (over: Partial<slotBookingZodType>) =>
  ({ _id: "a", name: "x", phonenumber: 1, doctorId: "THR-1", doctor: "Asha", status: "completed", ...over }) as slotBookingZodType;

describe("buildEarningRows", () => {
  it("maps one part to one row, showing everything the part is worth", () => {
    const p = part({ pending: { ...bucket(500, 350), due: 500 }, upcoming: bucket(500, 350) });
    const [row, ...rest] = buildEarningRows([booking({ payout: [p] })]);

    expect(rest).toHaveLength(0);
    expect(row.therapistId).toBe("THR-1");
    expect(row.therapistName).toBe("Asha");
    expect(row.splitPercent).toBe(70);
    expect(row.sessionsCompleted).toBe(1);
    expect(row.revenue).toBe(2000);
    expect(row.therapistCut).toBe(1400);
    expect(row.companyCut).toBe(600);
    expect(row.payout).toBe(p);
  });

  it("gives a row per part when a package changed therapist mid-way", () => {
    const rows = buildEarningRows([
      booking({
        doctorId: "THR-2",
        payout: [part(), part({ doctorId: "THR-2", doctor: "Ravi", splitPercent: 60, earned: bucket(1000, 600), owed: 600 })],
      }),
    ]);

    expect(rows.map((r) => [r.appointmentId, r.therapistId, r.therapistName, r.therapistCut])).toEqual([
      ["a", "THR-1", "Asha", 700],
      ["a", "THR-2", "Ravi", 600],
    ]);
  });

  it("skips rows with no parts (cancelled, or nothing sent)", () => {
    expect(buildEarningRows([booking({ status: "cancelled", payout: [] }), booking({})])).toEqual([]);
  });

  it("no therapist reads as Unassigned; a hidden split reads as null", () => {
    const [row] = buildEarningRows([
      booking({ payout: [part({ doctorId: "", doctor: "", splitPercent: undefined })] }),
    ]);
    expect(row.therapistName).toBe("Unassigned");
    expect(row.splitPercent).toBeNull();
  });

  it("customer payment: nothing due on the part's sessions, done or to come (the server's due)", () => {
    const received = (p: PayoutPart) => buildEarningRows([booking({ payout: [p] })])[0].paymentReceived;

    expect(received(part())).toBe(true);
    expect(received(part({ earned: bucket(), pending: bucket(1000, 700, { due: 400 }) }))).toBe(false);
    // A course paid in advance: its sessions to come owe nothing.
    expect(received(part({ sessions: 0, earned: bucket(), upcoming: bucket(1000, 700), owed: 0 }))).toBe(true);
    expect(received(part({ sessions: 0, earned: bucket(), upcoming: bucket(1000, 700, { due: 1000 }), owed: 0 }))).toBe(false);
  });

  it("discount and list price are the part's own, in rupees", () => {
    const [row] = buildEarningRows([
      booking({ discountCode: "DIWALI", payout: [part({ earned: bucket(800, 600, { discount: 200 }), upcoming: bucket(800, 600, { discount: 200 }) })] }),
    ]);
    expect(row).toMatchObject({ discountAmount: 400, originalPrice: 2000, discountCode: "DIWALI" });
  });
});

describe("isUpcoming", () => {
  it("is true only while nothing on the part is done", () => {
    const rowOf = (p: PayoutPart) => buildEarningRows([booking({ payout: [p] })])[0];
    expect(isUpcoming(rowOf(part({ sessions: 0, earned: bucket(), upcoming: bucket(1000, 700) })))).toBe(true);
    expect(isUpcoming(rowOf(part({ upcoming: bucket(1000, 700) })))).toBe(false);
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

describe("computeEarningsSummary", () => {
  it("totals come from the server's buckets, never a recomputed split", () => {
    const rows = buildEarningRows([
      booking({
        _id: "a",
        payout: [
          part({ paidOut: 700, owed: 0 }),
          part({ doctorId: "THR-2", doctor: "Ravi", earned: bucket(1000, 600), paidOut: 900, owed: -300 }),
        ],
      }),
      booking({
        _id: "b",
        status: "ongoing",
        payout: [
          part({
            sessions: 2,
            earned: bucket(500, 350),
            pending: bucket(500, 350, { due: 300 }),
            upcoming: bucket(1000, 700),
            owed: 350,
          }),
        ],
      }),
      booking({
        _id: "c",
        status: "scheduled",
        payout: [part({ sessions: 0, earned: bucket(), upcoming: bucket(800, 560), owed: 0 })],
      }),
    ]);
    const s = computeEarningsSummary(rows);

    expect(s.totalRevenue).toBe(2500);
    expect(s.totalTherapistPayout).toBe(1650);
    expect(s.totalCompanyEarnings).toBe(850);
    expect(s.totalPending).toBe(300);
    expect(s.completedSessions).toBe(4);
    // Done revenue (2500 earned + 500 pending) over 4 done sessions.
    expect(s.avgPerSession).toBe(750);
    expect(s.upcomingSessions).toBe(2);
    expect(s.upcomingRevenue).toBe(1800);
    expect(s.upcomingTherapistCut).toBe(1260);
  });

  it("discount given is only what was taken off earned sessions", () => {
    const rows = buildEarningRows([
      booking({
        payout: [
          part({ earned: bucket(800, 600, { discount: 200 }), upcoming: bucket(800, 600, { discount: 200 }) }),
          part({ doctorId: "THR-2", doctor: "Ravi", earned: bucket(900, 450, { discount: 100 }) }),
        ],
      }),
    ]);
    const s = computeEarningsSummary(rows);
    expect(s.totalDiscountGiven).toBe(300);
    expect(s.totalOriginalRevenue).toBe(2000); // 1,700 earned + 300 discount
  });

  it("nothing done yet: every earned total is zero", () => {
    const s = computeEarningsSummary(
      buildEarningRows([booking({ status: "scheduled", payout: [part({ sessions: 0, earned: bucket(), upcoming: bucket(1000, 700), owed: 0 })] })]),
    );
    expect(s.completedSessions).toBe(0);
    expect(s.totalTherapistPayout).toBe(0);
    expect(s.avgPerSession).toBe(0);
    expect(s.upcomingSessions).toBe(1);
  });
});
