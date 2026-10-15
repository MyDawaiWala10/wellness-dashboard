"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";

import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import { useAuthStore } from "@/providers/permission-provider";
import type { EnquiryType } from "@/type/schema";
import { playEnquiryBeep } from "@/lib/notification-sound";

// New leads are the office's job: therapists don't get the sound or pop-up,
// and don't run the 8-second check for them at all.
const OFFICE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "STAFF", "CUSTOMER_CARE"]);

export default function InboundBookingNotifier() {
  const { user } = useAuthStore();
  return OFFICE_ROLES.has(user?.role ?? "") ? <OfficeBookingNotifier /> : null;
}

function OfficeBookingNotifier() {
  const { user } = useAuthStore();
  const { data: enquiries } = useGetAllEnquiries(
    { id: user?.id, role: user?.role, userEmail: user?.userEmail },
  );

  const initialLoadedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enquiries || enquiries.length === 0) return;

    // On first load, seed the known IDs set without triggering alerts
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      const ids = new Set<string>();
      for (const e of enquiries) {
        const key = e._id || e.enquiryId || `${e.phonenumber}-${e.name}`;
        ids.add(key);
      }
      knownIdsRef.current = ids;
      return;
    }

    // On subsequent query refetches/updates, check for any brand-new records
    const newRecords: EnquiryType[] = [];
    for (const e of enquiries) {
      const key = e._id || e.enquiryId || `${e.phonenumber}-${e.name}`;
      if (!knownIdsRef.current.has(key)) {
        knownIdsRef.current.add(key);
        newRecords.push(e);
      }
    }

    if (newRecords.length > 0) {
      // Play soft chime sound
      playEnquiryBeep();

      // Show toast alert for each new record
      for (const rec of newRecords) {
        const name = rec.name || "Customer";
        const service = rec.service || rec.typeOfappointment || "New Booking";
        const phone = rec.phonenumber ? String(rec.phonenumber) : "";

        toast("🔔 New Inbound Booking Received!", {
          description: `${name} · ${service}${phone ? ` (${phone})` : ""}`,
          duration: 8000,
          action: {
            label: "View Enquiries",
            onClick: () => {
              window.location.href = "/dashboard/enquiries";
            },
          },
        });
      }
    }
  }, [enquiries]);

  return null;
}
