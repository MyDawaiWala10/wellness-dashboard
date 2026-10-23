"use client";

// Throwaway preview of the Billing tab. Delete with the branch.
import { BillingTab } from "@/components/pages/appointment/billing-tab";
import type { slotBookingZodType } from "@/type/schema";

// "appointment" is what renders as "Home visit" (see BOOKING_TYPES).
const base: Partial<slotBookingZodType> = {
  name: "totherapist1234",
  phonenumber: 8745351202,
  typeOfappointment: "appointment",
  enquiryId: "ENQ-0082",
};

const discounted = {
  ...base,
  quotedPrice: 1600,
  originalPrice: 2000,
  recommendedServices: [
    {
      serviceId: "SRV-1",
      serviceName: "Deep tissue add-on",
      quotedPrice: 500,
      status: "confirmed",
      recommendedAt: "2026-09-25T10:00:00.000Z",
    },
    {
      serviceId: "SRV-2",
      serviceName: "Posture assessment",
      quotedPrice: 700,
      status: "pending",
      recommendedAt: "2026-09-25T11:00:00.000Z",
    },
  ],
} as slotBookingZodType;

const plain = { ...base, quotedPrice: 1600 } as slotBookingZodType;

export default function BillingPreview() {
  return (
    <div className="grid w-full max-w-4xl gap-6 p-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-semibold">Discounted + add-ons</p>
        <div className="rounded-lg border p-3">
          <BillingTab appointment={discounted} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">No discount (your ENQ-0082)</p>
        <div className="rounded-lg border p-3">
          <BillingTab appointment={plain} />
        </div>
      </div>
    </div>
  );
}
