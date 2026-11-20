// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { TherapistLeave } from "@/actions/therapist/therapist-leaves";

type LeavesResult = { success: boolean; data: TherapistLeave[]; message?: string };

const toLeaves = (res: { success: boolean; data?: TherapistLeave[]; message: string }): LeavesResult =>
  res.success ? { success: true, data: res.data ?? [] } : { success: false, data: [], message: res.message };

export async function getTherapistLeaves(doctorId: string): Promise<LeavesResult> {
  return toLeaves(await apiGet<TherapistLeave[]>(`therapist-leaves/${encodeURIComponent(doctorId)}`));
}

export async function getAllTherapistLeaves(date?: string): Promise<LeavesResult> {
  return toLeaves(await apiGet<TherapistLeave[]>(date ? `therapist-leaves?date=${encodeURIComponent(date)}` : "therapist-leaves"));
}
