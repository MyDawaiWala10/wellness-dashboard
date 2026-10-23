"use client";

// Throwaway preview of the booking-source pills and picker. Delete after review.
import { useState } from "react";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { BookingSourceField } from "@/components/booking-source-field";
import { bookingSourceError, type BookingSourceValue } from "@/lib/booking-source";

const rows = [
  { enquiryId: "ENQ-0101", source: "online", note: "Online (website)" },
  { enquiryId: "ENQ-0102", source: "whatsapp", note: "WhatsApp" },
  { enquiryId: "ENQ-0103", source: "walk_in", note: "Walk-in (shop)" },
  {
    enquiryId: "ENQ-0104",
    source: "therapist",
    referredByName: "Dr. Reddy",
    note: "Via Therapist (hover for name)",
  },
  { enquiryId: "ENQ-0082", source: "dashboard", note: "Old staff-entered -> WhatsApp" },
  { enquiryId: "ENQ-0050", source: "public_booking_form", note: "Old website -> Online" },
  { enquiryId: "ENQ-0010", source: undefined, note: "No source at all -> WhatsApp" },
];

export default function SourcePreview() {
  const [pick, setPick] = useState<BookingSourceValue>({ source: "" });

  return (
    <div className="w-full max-w-xl space-y-6 p-6">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.enquiryId} className="border-b">
              <td className="py-2">
                <BookingIdBadge record={r} />
              </td>
              <td className="py-2 text-muted-foreground">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Picker (as in New Enquiry)</p>
        <BookingSourceField
          value={pick}
          onChange={setPick}
          error={bookingSourceError(pick)}
        />
      </div>
    </div>
  );
}
