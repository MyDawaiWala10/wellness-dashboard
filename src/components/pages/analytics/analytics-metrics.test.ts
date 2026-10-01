import { describe, it, expect } from "vitest";

import {
  deriveAnalytics,
  deriveMoM,
  deriveDailyPacing,
} from "./analytics-metrics";
import type { EnquiryType } from "@/type/schema";

const rec = (over: Partial<EnquiryType>): EnquiryType =>
  ({ name: "x", phonenumber: 1, ...over }) as EnquiryType;

// createdAt isn't on EnquiryType; the metrics read it via an unknown cast.
const at = (iso: string) => ({ createdAt: iso }) as Partial<EnquiryType>;

const NOW = new Date("2026-07-28T10:00:00.000Z");

// No therapists needed for the revenue / funnel checks below.
const analytics = (records: EnquiryType[], now: Date) =>
  deriveAnalytics(records, new Map(), now);

describe("deriveAnalytics", () => {
  it("splits collected vs pending, and prices pending from quotedPrice", () => {
    const a = analytics(
      [
        rec({ typeOfappointment: "appointment", paymentReceived: true, paymentAmount: 700 }),
        rec({ typeOfappointment: "consultation", paymentReceived: false, quotedPrice: 500 }),
        rec({ status: "cancelled", paymentReceived: true, paymentAmount: 999 }), // ignored
      ],
      NOW,
    );
    expect(a.collected).toBe(700);
    expect(a.pending).toBe(500);
    expect(a.pendingCount).toBe(1);
    expect(Math.round(a.collectedPct)).toBe(58); // 700 / 1200
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
  it("uses each booking's locked-in split, else its therapist's split", () => {
    const a = deriveAnalytics(
      [
        // Locked in at 60% when it completed; the therapist is now at 70%.
        rec({ doctor: "Asha", doctorId: "THR-1", paymentReceived: true, paymentAmount: 1000, therapistSplitPercent: 60 }),
        // Not completed yet: follows the therapist's current 70%.
        rec({ doctor: "Asha", doctorId: "THR-1", paymentReceived: true, paymentAmount: 1000 }),
      ],
      new Map([["THR-1", 70]]),
      NOW,
    );
    expect(a.therapistPayoutTotal).toBe(600 + 700);
    expect(a.companyEarningsTotal).toBe(400 + 300);
  });
});
