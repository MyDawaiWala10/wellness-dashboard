import type { PayoutPart, slotBookingZodType } from "@/type/schema";

/**
 * One therapist's share of one booking row. Every figure comes from the
 * server's `payout` parts (backend lib/payouts.ts); the dashboard never works
 * out a cut. appointmentId + therapistId identify a row: a package that
 * changed therapist mid-way gives one row per therapist.
 */
export type EarningRow = {
  appointmentId: string;
  enquiryId: string;
  /** Carried through so the row's booking-ID pill can be coloured. */
  source?: string;
  referredByName?: string | null;
  date: string;
  customerName: string;
  therapistName: string;
  therapistId: string;
  service: string;
  /** Sessions this therapist has done on the row. */
  sessionsCompleted: number;
  /** List price of this part (revenue + discount). */
  originalPrice: number;
  /** Rupees taken off this part's sessions (the server's buckets). */
  discountAmount: number;
  discountCode: string | null;
  /** Earned + pending + upcoming: all this part is worth, for display. */
  revenue: number;
  paymentReceived: boolean;
  therapistCut: number;
  companyCut: number;
  /** null: no split set, or not shown to this viewer (non-admins). */
  splitPercent: number | null;
  /** Something was paid out and nothing is owed now. */
  /** Booking status for display: completed, ongoing, scheduled, etc. */
  status: string;
  /** The server's figures for this part; the summary reads its buckets. */
  payout: PayoutPart;
  rawAppointment: slotBookingZodType;
};

export type EarningsSummary = {
  totalRevenue: number;
  totalOriginalRevenue: number;
  totalDiscountGiven: number;
  totalTherapistPayout: number;
  totalCompanyEarnings: number;
  /** What customers still owe for sessions already done. */
  totalPending: number;
  completedSessions: number;
  avgPerSession: number;
  /** Rows with sessions still to come, and what those are worth: kept out of every total above. */
  upcomingSessions: number;
  upcomingRevenue: number;
  upcomingTherapistCut: number;
};

/** Nothing on this row is done yet: listed, but it adds nothing to the earned totals. */
export const isUpcoming = (r: EarningRow): boolean =>
  r.payout.sessions === 0 && r.payout.earned.revenue + r.payout.pending.revenue === 0;

/** Only Admin / Super Admin see or set split percentages, and record payouts. */
export function canManageSplit(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** One row per payout part; rows the server sends no parts for (a bare lead, a booking cancelled before anything was done) are skipped. */
export function buildEarningRows(appointments: slotBookingZodType[]): EarningRow[] {
  const rows: EarningRow[] = [];

  for (const a of appointments) {
    const date =
      a.completedAt ??
      a.slot?.date ??
      (a as any).createdAt ??
      "";

    for (const p of a.payout ?? []) {
      const total = (k: "revenue" | "therapistCut" | "companyCut" | "discount" | "due") =>
        p.earned[k] + p.pending[k] + p.upcoming[k];

      rows.push({
        appointmentId: a._id ?? "",
        enquiryId: a.enquiryId ?? "",
        source: a.source,
        referredByName: a.referredByName,
        date,
        customerName: a.name ?? "Unknown",
        therapistName: p.doctorId ? p.doctor : "Unassigned",
        therapistId: p.doctorId,
        service: a.service ?? a.typeOfappointment ?? "-",
        sessionsCompleted: p.sessions,
        originalPrice: total("revenue") + total("discount"),
        discountAmount: total("discount"),
        discountCode: a.discountCode ?? null,
        revenue: total("revenue"),
        // Nothing still owed by the customer for this part's sessions, done or to come.
        paymentReceived: total("due") === 0,
        therapistCut: total("therapistCut"),
        companyCut: total("companyCut"),
        splitPercent: p.splitPercent ?? null,
        status: a.status ?? "scheduled",
        payout: p,
        rawAppointment: a,
      });
    }
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function computeEarningsSummary(rows: EarningRow[]): EarningsSummary {
  const sum = (pick: (p: PayoutPart) => number) => rows.reduce((s, r) => s + pick(r.payout), 0);
  const completedSessions = sum((p) => p.sessions);
  const totalRevenue = sum((p) => p.earned.revenue);
  const totalDiscountGiven = sum((p) => p.earned.discount);

  return {
    totalRevenue,
    totalOriginalRevenue: totalRevenue + totalDiscountGiven,
    totalDiscountGiven,
    totalTherapistPayout: sum((p) => p.earned.therapistCut),
    totalCompanyEarnings: sum((p) => p.earned.companyCut),
    totalPending: sum((p) => p.pending.due),
    completedSessions,
    // Average worth of a done session, paid for or not: the server counts done
    // sessions but not which of them are paid, so it's done revenue / done sessions.
    avgPerSession:
      completedSessions > 0
        ? Math.round(sum((p) => p.earned.revenue + p.pending.revenue) / completedSessions)
        : 0,
    upcomingSessions: rows.filter((r) => r.payout.upcoming.revenue > 0).length,
    upcomingRevenue: sum((p) => p.upcoming.revenue),
    upcomingTherapistCut: sum((p) => p.upcoming.therapistCut),
  };
}
