"use client";

import { useQuery } from "@tanstack/react-query";
import getAllAppointments from "@/actions/appointments/get-all-appointments";
import { getCustomers } from "@/actions/customers/get-customers";
import type { EnquiryType, UserType } from "@/type/schema";
import type { CustomerNote, PersistedCustomer } from "@/type/customer-record";
import { isTodayISO, readCreatedISO } from "@/lib/metrics";
import { personAge } from "@/lib/person";

/**
 * A customer is derived from appointments (grouped by phone) and enriched with
 * the persisted `customer_id` from `/api/customers` when available.
 */
export type CustomerSegment = "new" | "returning" | "vip";

export interface Customer {
  customer_id?: string;
  phonenumber: number;
  name: string;
  email?: string;
  location?: string;
  gender?: string;
  age?: number;
  bookings: EnquiryType[];     // sorted newest-first
  totalBookings: number;       // excluding cancelled
  totalAll: number;            // including cancelled (for "all-time" stats if needed)
  firstBookingAt?: string;     // ISO from earliest createdAt
  lastBookingAt?: string;      // ISO from latest createdAt
  segment: CustomerSegment;
  notes?: CustomerNote[];      // therapist notes about this customer
}

function readTimestamp(r: EnquiryType, key: "createdAt" | "updatedAt"): number {
  const ts = (r as unknown as Record<string, string | undefined>)[key];
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function segmentFor(activeCount: number): CustomerSegment {
  if (activeCount >= 5) return "vip";
  if (activeCount >= 2) return "returning";
  return "new";
}

/**
 * Identity is phone + person, not phone alone: one household number can serve
 * several patients. Mirrors the backend (ensureCustomerForAppointment) so a
 * shared number shows one card per person here too.
 */
export function identityKey(phone: number, name: string | undefined): string {
  return `${phone}|${(name ?? "").trim().toLowerCase()}`;
}

/**
 * Group a flat list of appointment records into Customer aggregates.
 * Exported so the page can recompute KPIs from the same source.
 */
export function deriveCustomers(
  records: EnquiryType[],
  persistedByKey?: Map<string, PersistedCustomer>,
): Customer[] {
  // Group by phone + name so two patients on one household number are two
  // customers, not one merged card.
  const buckets = new Map<string, EnquiryType[]>();
  for (const r of records) {
    if (!r.phonenumber) continue;
    const key = identityKey(r.phonenumber, r.name);
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }

  const out: Customer[] = [];
  for (const [key, list] of buckets.entries()) {
    // Sort newest-first by createdAt
    const sorted = [...list].sort(
      (a, b) => readTimestamp(b, "createdAt") - readTimestamp(a, "createdAt"),
    );
    const latest = sorted[0];
    const phonenumber = latest.phonenumber;
    const totalAll = sorted.length;
    const activeBookings = sorted.filter((r) => r.status !== "cancelled");
    const totalBookings = activeBookings.length;
    const persisted = persistedByKey?.get(key);

    out.push({
      customer_id: persisted?.customer_id,
      phonenumber,
      name: persisted?.name ?? latest.name ?? "Unnamed",
      email: persisted?.email || latest.email || undefined,
      location: persisted?.address || latest.location || undefined,
      gender: persisted?.gender || latest.gender || undefined,
      age: personAge(persisted) ?? (latest.age || undefined),
      bookings: sorted,
      totalBookings,
      totalAll,
      firstBookingAt: sorted[sorted.length - 1]
        ? new Date(readTimestamp(sorted[sorted.length - 1], "createdAt")).toISOString()
        : undefined,
      lastBookingAt: latest
        ? new Date(readTimestamp(latest, "createdAt")).toISOString()
        : undefined,
      segment: segmentFor(totalBookings),
      notes: persisted?.notes,
    });
  }

  // Sort customers by their most recent booking
  out.sort((a, b) => {
    const aT = a.lastBookingAt ? new Date(a.lastBookingAt).getTime() : 0;
    const bT = b.lastBookingAt ? new Date(b.lastBookingAt).getTime() : 0;
    return bT - aT;
  });

  return out;
}

export interface CustomerStats {
  totalCustomers: number;
  totalBookings: number;
  bookingsThisMonth: number;
  returningCustomers: number;
}

/** KPI cards - all derived client-side from grouped customers. */
export function computeCustomerStats(customers: Customer[]): CustomerStats {
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).getTime();

  let bookingsThisMonth = 0;
  for (const c of customers) {
    for (const b of c.bookings) {
      if (b.status === "cancelled") continue;
      const ts = readTimestamp(b, "createdAt");
      if (ts >= monthStart) bookingsThisMonth++;
    }
  }

  return {
    totalCustomers: customers.length,
    totalBookings: customers.reduce((sum, c) => sum + c.totalBookings, 0),
    bookingsThisMonth,
    returningCustomers: customers.filter((c) => c.totalBookings >= 2).length,
  };
}

export interface CustomerTodayStats {
  newCustomersToday: number;
  bookingsToday: number;
  returningToday: number;
}

/** "Today" KPI cards for the Customers page - derived from grouped customers. */
export function computeCustomerTodayStats(
  customers: Customer[],
): CustomerTodayStats {
  let newCustomersToday = 0;
  let bookingsToday = 0;
  let returningToday = 0;
  for (const c of customers) {
    if (isTodayISO(c.firstBookingAt)) newCustomersToday++;
    // An existing customer (first booking before today) who booked again today.
    if (isTodayISO(c.lastBookingAt) && !isTodayISO(c.firstBookingAt)) {
      returningToday++;
    }
    for (const b of c.bookings) {
      if (b.status === "cancelled") continue;
      if (isTodayISO(readCreatedISO(b))) bookingsToday++;
    }
  }
  return { newCustomersToday, bookingsToday, returningToday };
}

export function useGetCustomers(
  user: UserType,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["customers", user?.id, user?.role, user?.userEmail] as const,
    queryFn: async (): Promise<Customer[]> => {
      const [apptResult, custResult] = await Promise.all([
        getAllAppointments(user),
        getCustomers(),
      ]);

      if (!apptResult.success) throw new Error(apptResult.message);

      const persistedByKey = new Map<string, PersistedCustomer>();
      if (custResult.success && custResult.data) {
        for (const c of custResult.data) {
          if (c.phone) persistedByKey.set(identityKey(c.phone, c.name), c);
        }
      }

      const records = (apptResult.data ?? []) as EnquiryType[];
      return deriveCustomers(records, persistedByKey);
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 1000, // 5 seconds - short so session notes written during a visit appear promptly
    // undefined leaves React Query's default (enabled) - existing callers keep
    // fetching; the intake modal passes `false` until it's actually open.
    enabled: options?.enabled,
  });
}
