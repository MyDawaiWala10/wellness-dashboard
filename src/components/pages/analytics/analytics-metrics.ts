import { readCreatedISO } from "@/lib/metrics";
import type { EnquiryType } from "@/type/schema";
import { splitFor, splitRevenue, type TherapistSplits } from "@/lib/earnings";

/**
 * Analytics for a SERVICE business, derived client-side from the appointments
 * list the app already fetches - same pattern as the dashboard/customers pages.
 * Everything here is a plain function so it can be unit-tested with arrays.
 *
 * ponytail: client-side derivation; when record counts outgrow a single fetch,
 * move this aggregation into a server endpoint (see analytics spec §4).
 */

const BOOKING_STATUSES = ["scheduled", "ongoing", "completed"];

const statusOf = (r: EnquiryType) => r.status ?? "enquiry";
const isCancelled = (r: EnquiryType) => statusOf(r) === "cancelled";

/** The money on a record - the amount actually taken, else the quoted price. */
const amountOf = (r: EnquiryType) => r.paymentAmount ?? r.quotedPrice ?? 0;

/** A confirmed booking: a booking type was chosen (pay-first funnel) or it has
 *  already moved into a booked status. Cancelled never counts. */
const isBooked = (r: EnquiryType) =>
  !isCancelled(r) &&
  (!!r.typeOfappointment || BOOKING_STATUSES.includes(statusOf(r)));

const isPaid = (r: EnquiryType) => !!r.paymentReceived && !isCancelled(r);

/** "YYYY-MM" for the timestamp that best represents when revenue landed. */
function monthKey(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const TYPE_LABELS: Record<string, string> = {
  consultation: "Online Consultation",
  appointment: "Home Visit",
};

export interface AnalyticsResult {
  // Zone A - business health
  revenueThisMonth: number;
  collected: number;
  pending: number;
  collectedPct: number; // 0-100
  bookingsThisMonth: number;
  conversionPct: number; // paid ÷ enquiries, 0-100
  pipeline: { enquiries: number; bookings: number; paid: number };
  serviceMix: { label: string; revenue: number }[]; // desc
  revenueTrend: { month: string; revenue: number; momPct: number | null }[]; // oldest→newest
  // Zone B - operational
  pendingCount: number;
  needsFirstContact: number;
  therapistLoad: { name: string; bookings: number }[]; // desc, this week
  // Zone C - earnings breakdown
  therapistPayoutTotal: number;
  therapistPayoutPaid: number;
  therapistPayoutOwed: number;
  companyEarningsTotal: number;
  therapistEarningsBreakdown: {
    name: string;
    revenue: number;
    therapistCut: number;
    companyCut: number;
    paidCut: number;
    owedCut: number;
  }[];
  hasData: boolean;
}

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday-start; good enough for a week bucket
  return d;
}

export function deriveAnalytics(
  records: EnquiryType[],
  splits: TherapistSplits,
  now: Date = new Date(),
): AnalyticsResult {
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const live = records.filter((r) => !isCancelled(r));

  // Revenue timing: when payment landed, else when the record was created.
  const revenueMonth = (r: EnquiryType) =>
    monthKey(r.paymentReceivedAt ?? readCreatedISO(r));

  let collected = 0;
  let pending = 0;
  let revenueThisMonth = 0;
  let bookingsThisMonth = 0;
  const mixByLabel = new Map<string, number>();
  const trendByMonth = new Map<string, number>();

  for (const r of live) {
    const amt = amountOf(r);
    if (isPaid(r)) {
      collected += amt;
      const m = revenueMonth(r);
      if (m) trendByMonth.set(m, (trendByMonth.get(m) ?? 0) + amt);
      if (m === thisMonth) revenueThisMonth += amt;
      const label = TYPE_LABELS[r.typeOfappointment ?? ""] ?? "Other";
      mixByLabel.set(label, (mixByLabel.get(label) ?? 0) + amt);
    } else if (isBooked(r)) {
      pending += r.quotedPrice ?? 0;
    }
    if (isBooked(r) && monthKey(readCreatedISO(r)) === thisMonth) {
      bookingsThisMonth++;
    }
  }

  const enquiries = live.length;
  const bookings = live.filter(isBooked).length;
  const paid = live.filter(isPaid).length;

  const serviceMix = [...mixByLabel.entries()]
    .map(([label, revenue]) => ({ label, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Last 6 months, oldest→newest, with month-over-month growth.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const revenueTrend = months.map((month, i) => {
    const revenue = trendByMonth.get(month) ?? 0;
    const prev = i > 0 ? (trendByMonth.get(months[i - 1]) ?? 0) : 0;
    const momPct = i > 0 && prev > 0 ? ((revenue - prev) / prev) * 100 : null;
    return { month, revenue, momPct };
  });

  const needsFirstContact = live.filter(
    (r) =>
      statusOf(r) === "enquiry" &&
      !r.executiveReachedOut &&
      (r.reachAttempts ?? 0) === 0,
  ).length;

  // Therapist load this week - bookings with a therapist + slot this week.
  const weekStart = startOfWeek(now);
  const loadByName = new Map<string, number>();
  for (const r of live) {
    if (!r.doctorId && !r.doctor) continue;
    if (!r.slot?.date) continue;
    const d = new Date(r.slot.date);
    if (Number.isNaN(d.getTime()) || d < weekStart) continue;
    const name = r.doctor?.trim() || "Unnamed therapist";
    loadByName.set(name, (loadByName.get(name) ?? 0) + 1);
  }
  const therapistLoad = [...loadByName.entries()]
    .map(([name, bookings]) => ({ name, bookings }))
    .sort((a, b) => b.bookings - a.bookings);

  let therapistPayoutTotal = 0;
  let therapistPayoutPaid = 0;
  let therapistPayoutOwed = 0;
  let companyEarningsTotal = 0;
  const breakdownByName = new Map<string, { revenue: number; therapistCut: number; companyCut: number; paidCut: number; owedCut: number }>();

  for (const r of live) {
    if (!isPaid(r)) continue;
    const amt = amountOf(r);
    const { therapistCut: tCut, companyCut: cCut } = splitRevenue(amt, splitFor(r, splits));
    therapistPayoutTotal += tCut;
    companyEarningsTotal += cCut;

    const isTherapistPaid = !!(r as any).therapistPaid;
    if (isTherapistPaid) {
      therapistPayoutPaid += tCut;
    } else {
      therapistPayoutOwed += tCut;
    }

    const tName = r.doctor?.trim() || "Unassigned";
    const existing = breakdownByName.get(tName) ?? { revenue: 0, therapistCut: 0, companyCut: 0, paidCut: 0, owedCut: 0 };
    breakdownByName.set(tName, {
      revenue: existing.revenue + amt,
      therapistCut: existing.therapistCut + tCut,
      companyCut: existing.companyCut + cCut,
      paidCut: existing.paidCut + (isTherapistPaid ? tCut : 0),
      owedCut: existing.owedCut + (!isTherapistPaid ? tCut : 0),
    });
  }

  const therapistEarningsBreakdown = [...breakdownByName.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    revenueThisMonth,
    collected,
    pending,
    collectedPct: collected + pending > 0 ? (collected / (collected + pending)) * 100 : 0,
    bookingsThisMonth,
    conversionPct: enquiries > 0 ? (paid / enquiries) * 100 : 0,
    pipeline: { enquiries, bookings, paid },
    serviceMix,
    revenueTrend,
    pendingCount: live.filter((r) => isBooked(r) && !isPaid(r)).length,
    needsFirstContact,
    therapistLoad,
    therapistPayoutTotal,
    therapistPayoutPaid,
    therapistPayoutOwed,
    companyEarningsTotal,
    therapistEarningsBreakdown,
    hasData: records.length > 0,
  };
}

// ── Month-over-month growth series ───────────────────────────────────────────
// The line plots the MoM DELTA (blue when up, red when down); cards show the
// absolute monthly value plus that delta. Faithful to the reference dashboard,
// reframed for a service business (revenue, bookings, new & repeat customers).

export interface MonthPoint {
  month: string; // "YYYY-MM"
  value: number; // absolute value that month
  delta: number; // value[m] − value[m-1]
}

export interface MoMSeries {
  revenue: MonthPoint[];
  bookings: MonthPoint[];
  newCustomers: MonthPoint[];
  repeatCustomers: MonthPoint[];
}

/** Identity is phone + person (mirrors the backend); inlined to keep this a
 *  pure, node-testable module with no client imports. */
const idKey = (r: EnquiryType) =>
  `${r.phonenumber}|${(r.name ?? "").trim().toLowerCase()}`;

/** The revenue-landed month for a paid record. */
const paidMonth = (r: EnquiryType) => monthKey(r.paymentReceivedAt ?? readCreatedISO(r));
const createdMonth = (r: EnquiryType) => monthKey(readCreatedISO(r));

/** N+1 "YYYY-MM" keys ending at `now`'s month - the extra leading month gives
 *  the first displayed month a real previous value for its delta. */
function monthWindow(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Turn a value-by-month map into points with MoM deltas, dropping the leading
 *  padding month. */
function toPoints(window: string[], valueByMonth: Map<string, number>): MonthPoint[] {
  const pts: MonthPoint[] = [];
  for (let i = 1; i < window.length; i++) {
    const value = valueByMonth.get(window[i]) ?? 0;
    const prev = valueByMonth.get(window[i - 1]) ?? 0;
    pts.push({ month: window[i], value, delta: value - prev });
  }
  return pts;
}

/**
 * Month-over-month series for the last `months` months (default 12; the chart
 * can show a 6-month slice). Computes one extra leading month so the first
 * point's delta is real.
 */
export function deriveMoM(
  records: EnquiryType[],
  now: Date = new Date(),
  months = 12,
): MoMSeries {
  const window = monthWindow(now, months);
  const inWindow = new Set(window);
  const live = records.filter((r) => !isCancelled(r));

  const revenue = new Map<string, number>();
  const bookings = new Map<string, number>();

  // Per-customer month activity, for new vs repeat.
  const monthsByCustomer = new Map<string, Set<string>>();

  for (const r of live) {
    if (isPaid(r)) {
      const m = paidMonth(r);
      if (m) revenue.set(m, (revenue.get(m) ?? 0) + amountOf(r));
    }
    if (isBooked(r)) {
      const m = createdMonth(r);
      if (m) bookings.set(m, (bookings.get(m) ?? 0) + 1);
    }
    if (r.phonenumber) {
      const cm = createdMonth(r);
      if (cm) {
        const set = monthsByCustomer.get(idKey(r)) ?? new Set<string>();
        set.add(cm);
        monthsByCustomer.set(idKey(r), set);
      }
    }
  }

  const newCustomers = new Map<string, number>();
  const repeatCustomers = new Map<string, number>();
  for (const set of monthsByCustomer.values()) {
    const sorted = [...set].sort();
    const first = sorted[0];
    newCustomers.set(first, (newCustomers.get(first) ?? 0) + 1);
    // Every later month this customer was active counts as a repeat that month.
    for (const m of sorted.slice(1)) {
      repeatCustomers.set(m, (repeatCustomers.get(m) ?? 0) + 1);
    }
  }

  // Only keep points inside the window (the maps may hold older months).
  const clip = (m: Map<string, number>) => {
    const out = new Map<string, number>();
    for (const [k, v] of m) if (inWindow.has(k)) out.set(k, v);
    return out;
  };

  return {
    revenue: toPoints(window, clip(revenue)),
    bookings: toPoints(window, clip(bookings)),
    newCustomers: toPoints(window, clip(newCustomers)),
    repeatCustomers: toPoints(window, clip(repeatCustomers)),
  };
}

// ── Daily revenue pacing (one month vs the previous) ─────────────────────────

export interface DailyPoint {
  day: number; // 1..daysInMonth
  current: number;
  previous: number;
}

const prevMonthKey = (month: string): string => {
  const [y, mo] = month.split("-").map(Number);
  const d = new Date(y, mo - 2, 1); // mo is 1-based → mo-2 is the previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Daily collected revenue for `month` vs the month before, aligned by day. */
export function deriveDailyPacing(
  records: EnquiryType[],
  month: string,
): DailyPoint[] {
  const [y, mo] = month.split("-").map(Number);
  const prev = prevMonthKey(month);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const cur = new Array(32).fill(0);
  const prv = new Array(32).fill(0);

  for (const r of records) {
    if (!isPaid(r)) continue;
    const iso = r.paymentReceivedAt ?? readCreatedISO(r);
    const m = monthKey(iso);
    if (!m || (m !== month && m !== prev)) continue;
    const d = new Date(iso as string);
    const day = d.getDate();
    (m === month ? cur : prv)[day] += amountOf(r);
  }

  const out: DailyPoint[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    out.push({ day, current: cur[day], previous: prv[day] });
  }
  return out;
}

/** Month options for the pacing picker - the last `count` months, newest first. */
export function monthOptions(
  now: Date = new Date(),
  count = 12,
): { key: string; label: string }[] {
  const opts: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}
