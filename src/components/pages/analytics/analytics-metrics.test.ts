import { describe, it, expect } from "vitest";

import {
  deriveAnalytics,
  deriveMoM,
  deriveDailyPacing,
} from "./analytics-metrics";
import type { EnquiryType, PayoutPart } from "@/type/schema";

const rec = (over: Partial<EnquiryType>): EnquiryType =>
  ({ name: "x", phonenumber: 1, ...over }) as EnquiryType;

// createdAt isn't on EnquiryType; the metrics read it via an unknown cast.
const at = (iso: string) => ({ createdAt: iso }) as Partial<EnquiryType>;

const NOW = new Date("2026-07-28T10:00:00.000Z");

const analytics = (records: EnquiryType[], now: Date) => deriveAnalytics(records, now);

describe("deriveAnalytics", () => {
  it("splits collected vs pending, and prices pending from quotedPrice", () => {
    const a = analytics(
      [
        rec({ typeOfappointment: "appointment", paymentReceived: true, quotedPrice: 700, paymentAmount: 700 }),
        rec({ typeOfappointment: "consultation", paymentReceived: false, quotedPrice: 500 }),
        rec({ status: "cancelled", paymentReceived: true, quotedPrice: 999, paymentAmount: 999 }), // ignored
      ],
      NOW,
    );
    expect(a.collected).toBe(700);
    expect(a.pending).toBe(500);
    expect(a.pendingCount).toBe(1);
    expect(Math.round(a.collectedPct)).toBe(58); // 700 / 1200
  });

  it("counts a part-paid booking's payment as collected and only the rest as pending", () => {
    const a = analytics(
      [rec({ typeOfappointment: "appointment", quotedPrice: 9000, paymentAmount: 1000, paymentReceived: false })],
      NOW,
    );
    expect(a.collected).toBe(1000);
    expect(a.pending).toBe(8000);
    expect(a.pendingCount).toBe(1);
  });

  it("adds nothing to pending for a course follow-up's tracking price", () => {
    const a = analytics(
      [
        rec({ _id: "s1", typeOfappointment: "appointment", quotedPrice: 3000, paymentAmount: 1000 }),
        rec({ _id: "s2", packageOriginId: "s1", typeOfappointment: "appointment", status: "scheduled", quotedPrice: 1000 }),
        rec({ _id: "s3", packageOriginId: "s1", typeOfappointment: "appointment", status: "scheduled", quotedPrice: 1000 }),
      ],
      NOW,
    );
    expect(a.pending).toBe(2000); // the course's own balance only
    expect(a.pendingCount).toBe(1);
  });

  it("builds the enquiry→booking→paid funnel", () => {
    const a = analytics(
      [
        rec({ status: "enquiry" }), // enquiry only
        rec({ typeOfappointment: "appointment" }), // booked, unpaid
        rec({ typeOfappointment: "consultation", paymentReceived: true, paymentAmount: 500 }), // booked + paid
      ],
      NOW,
    );
    expect(a.pipeline).toEqual({ enquiries: 3, bookings: 2, paid: 1 });
    expect(Math.round(a.conversionPct)).toBe(33); // 1 paid / 3 enquiries
  });

  it("counts only untouched leads as needing first contact", () => {
    const a = analytics(
      [
        rec({ status: "enquiry" }), // needs contact
        rec({ status: "enquiry", executiveReachedOut: true }), // reached
        rec({ status: "enquiry", reachAttempts: 1 }), // attempted
      ],
      NOW,
    );
    expect(a.needsFirstContact).toBe(1);
  });

  it("reports an honest empty state with no records", () => {
    const a = analytics([], NOW);
    expect(a.hasData).toBe(false);
    expect(a.collectedPct).toBe(0);
    expect(a.revenueTrend).toHaveLength(6);
  });
});

describe("deriveMoM", () => {
  it("plots the month-over-month revenue delta", () => {
    const m = deriveMoM(
      [
        rec({ paymentReceived: true, paymentAmount: 1000, paymentReceivedAt: "2026-06-10T00:00:00Z" }),
        rec({ paymentReceived: true, paymentAmount: 1500, paymentReceivedAt: "2026-07-05T00:00:00Z" }),
      ],
      NOW,
      12,
    );
    const jun = m.revenue.find((p) => p.month === "2026-06")!;
    const jul = m.revenue.find((p) => p.month === "2026-07")!;
    expect(jun.value).toBe(1000);
    expect(jul.value).toBe(1500);
    expect(jul.delta).toBe(500); // 1500 − 1000
  });

  it("separates a customer's first month (new) from later months (repeat)", () => {
    const m = deriveMoM(
      [
        rec({ phonenumber: 9, name: "Asha", ...at("2026-06-02T00:00:00Z") }),
        rec({ phonenumber: 9, name: "Asha", ...at("2026-07-02T00:00:00Z") }), // same person, later
      ],
      NOW,
      12,
    );
    expect(m.newCustomers.find((p) => p.month === "2026-06")!.value).toBe(1);
    expect(m.repeatCustomers.find((p) => p.month === "2026-07")!.value).toBe(1);
    expect(m.newCustomers.find((p) => p.month === "2026-07")!.value).toBe(0);
  });
});

describe("deriveDailyPacing", () => {
  it("aligns this month and the previous month by day", () => {
    const days = deriveDailyPacing(
      [
        rec({ paymentReceived: true, paymentAmount: 700, paymentReceivedAt: "2026-07-03T00:00:00Z" }),
        rec({ paymentReceived: true, paymentAmount: 400, paymentReceivedAt: "2026-06-03T00:00:00Z" }),
      ],
      "2026-07",
    );
    const d3 = days.find((d) => d.day === 3)!;
    expect(d3.current).toBe(700);
    expect(d3.previous).toBe(400);
    expect(days).toHaveLength(31); // July
  });
});

describe("deriveAnalytics - therapist payouts", () => {
  const bucket = (revenue = 0, therapistCut = 0) => ({ revenue, therapistCut, companyCut: revenue - therapistCut, discount: 0, due: 0 });
  const part = (over: Partial<PayoutPart>): PayoutPart => ({
    doctorId: "THR-1",
    doctor: "Asha",
    sessions: 0,
    earned: bucket(),
    pending: { ...bucket(), due: 0 },
    upcoming: bucket(),
    paidOut: 0,
    owed: 0,
    ...over,
  });

  it("owes nothing on a course paid upfront with no session done", () => {
    const a = analytics(
      [
        rec({
          status: "scheduled",
          quotedPrice: 4000,
          paymentAmount: 4000,
          paymentReceived: true,
          payout: [part({ upcoming: bucket(4000, 2400) })],
        }),
      ],
      NOW,
    );
    expect(a.therapistPayoutTotal).toBe(0);
    expect(a.companyEarningsTotal).toBe(0);
    expect(a.therapistEarningsBreakdown).toEqual([]);
  });

  it("totals the server's payout parts, per therapist", () => {
    const a = analytics(
      [
        // A package that changed hands: Asha did one session, Ravi two.
        rec({
          payout: [
            part({ sessions: 1, earned: bucket(1000, 600), paidOut: 600, owed: 0 }),
            part({ doctorId: "THR-2", doctor: "Ravi", sessions: 2, earned: bucket(2000, 1000), owed: 1000 }),
          ],
        }),
        // Asha was overpaid here: shows as nothing owed, not a credit.
        rec({ payout: [part({ sessions: 1, earned: bucket(500, 300), paidOut: 400, owed: -100 })] }),
        // No therapist: everything stays with the company.
        rec({ payout: [part({ doctorId: "", doctor: "", earned: bucket(700, 0) })] }),
        // Cancelled rows never count.
        rec({ status: "cancelled", payout: [part({ earned: bucket(9000, 9000), owed: 9000 })] }),
      ],
      NOW,
    );
    expect(a.therapistPayoutTotal).toBe(600 + 1000 + 300);
    expect(a.companyEarningsTotal).toBe(400 + 1000 + 200 + 700);
    expect(a.therapistEarningsBreakdown).toEqual([
      { name: "Ravi", revenue: 2000, therapistCut: 1000, companyCut: 1000 },
      { name: "Asha", revenue: 1500, therapistCut: 900, companyCut: 600 },
      { name: "Unassigned", revenue: 700, therapistCut: 0, companyCut: 700 },
    ]);
  });
});
