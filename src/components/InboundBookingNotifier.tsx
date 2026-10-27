"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import { useGetAllAppointments } from "@/data/appointment/appointment";
import { useAuthStore } from "@/providers/permission-provider";
import type { EnquiryType, slotBookingZodType } from "@/type/schema";
import { playEnquiryBeep } from "@/lib/notification-sound";
import { parentIdOf, visitWhen } from "@/lib/visit-groups";

// New leads are the office's job; a therapist is only told about bookings
// assigned to them (the server returns a therapist only their own bookings).
const OFFICE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "STAFF", "CUSTOMER_CARE"]);

export default function InboundBookingNotifier() {
  const { user } = useAuthStore();
  if (OFFICE_ROLES.has(user?.role ?? "")) return <OfficeBookingNotifier />;
  if (user?.role === "THERAPIST") return <TherapistBookingNotifier />;
  return null;
}

type Keyed = { _id?: string; enquiryId?: string; phonenumber?: number | string; name?: string };
const keyOf = (e: Keyed) => e._id || e.enquiryId || `${e.phonenumber}-${e.name}`;

/**
 * Calls onNew with records that weren't in the list before. The first load
 * only seeds what's already there, so opening the dashboard never alerts.
 */
function useNewRecords<T extends Keyed>(records: T[] | undefined, onNew: (fresh: T[]) => void) {
  const knownRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!records) return;
    if (!knownRef.current) {
      knownRef.current = new Set(records.map(keyOf));
      return;
    }
    const fresh = records.filter((r) => !knownRef.current!.has(keyOf(r)));
    fresh.forEach((r) => knownRef.current!.add(keyOf(r)));
    if (fresh.length > 0) onNew(fresh);
    // onNew is a fresh closure each render; only new data should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);
}

function OfficeBookingNotifier() {
  const { user } = useAuthStore();
  const { data: enquiries } = useGetAllEnquiries(
    { id: user?.id, role: user?.role, userEmail: user?.userEmail },
  );

  useNewRecords<EnquiryType>(enquiries, (newRecords) => {
    playEnquiryBeep();

    for (const rec of newRecords) {
      const name = rec.name || "Customer";
      const service = rec.service || rec.typeOfappointment || "New Booking";
      const phone = rec.phonenumber ? String(rec.phonenumber) : "";

      // A new record is either a lead (still an "enquiry") or an actual booking
      // (scheduled/ongoing/completed). They live on different pages, so the CTA
      // must route accordingly - a booking should not send you to Enquiries.
      const isBooking = !!rec.status && rec.status !== "enquiry";

      toast(isBooking ? "🔔 New Booking Received!" : "🔔 New Enquiry Received!", {
        description: `${name} · ${service}${phone ? ` (${phone})` : ""}`,
        duration: 8000,
        action: {
          label: isBooking ? "View Bookings" : "View Enquiries",
          onClick: () => {
            window.location.href = isBooking
              ? "/dashboard/appointments"
              : "/dashboard/enquiries";
          },
        },
      });
    }
  });

  return null;
}

function TherapistBookingNotifier() {
  const { user } = useAuthStore();
  // Same query as the Appointments page, which already refreshes every 15s.
  const { data: appointments } = useGetAllAppointments(
    { id: user?.id, role: user?.role, userEmail: user?.userEmail },
  );

  useNewRecords<slotBookingZodType>(appointments, (fresh) => {
    // A new course arrives as one visit per session: alert once for the
    // booking, not once per visit.
    const ids = new Set(fresh.map((r) => r._id));
    const bookings = fresh.filter((r) => !ids.has(parentIdOf(r) ?? ""));

    playEnquiryBeep();
    for (const rec of bookings) {
      const visits = fresh.filter((r) => parentIdOf(r) === rec._id).length;
      toast("🔔 New booking assigned to you", {
        description: `${rec.name || "Customer"} · ${visitWhen(rec)}${visits ? ` (+${visits} visits)` : ""}`,
        duration: 15000,
        action: {
          label: "View",
          onClick: () => {
            window.location.href = "/dashboard/appointments";
          },
        },
      });
    }
  });

  return null;
}
