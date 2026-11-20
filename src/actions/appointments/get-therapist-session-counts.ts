// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

export type TherapistSessionCount = {
  doctorId: string;
  totalSessions: number;
  completedBookings: number;
};

export default async function getTherapistSessionCounts(): Promise<ApiResponse<TherapistSessionCount[]>> {
  return apiGet("appointments/therapist-session-counts");
}
