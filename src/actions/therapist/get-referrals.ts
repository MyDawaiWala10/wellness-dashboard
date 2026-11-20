// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

export type ReferredBooking = {
  _id: string;
  enquiryId?: string;
  name: string;
  service?: string;
  status?: string;
  paymentReceived?: boolean;
  createdAt?: string;
};

/** Bookings that came in through this therapist's referral code. */
export default async function getReferrals(doctorId: string): Promise<ApiResponse<ReferredBooking[]>> {
  const res = await apiGet<ReferredBooking[]>(`therapist/${encodeURIComponent(doctorId)}/referrals`);
  return res.success ? { ...res, data: res.data ?? [] } : res;
}
