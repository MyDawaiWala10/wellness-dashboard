// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";

export type StaffUser = {
  _id: string;
  userfName: string;
  userlName: string;
  userEmail: string;
  role: string;
  isActive: boolean;
};

export default async function getAllUsers(): Promise<ApiResponse<StaffUser[]>> {
  // Backend shape: { data: { users: [...] } }, flattened to data: [...]
  const res = await apiGet<{ users?: StaffUser[] }>("users/getallusers");
  return res.success ? { ...res, data: res.data?.users ?? [] } : { ...res, data: undefined };
}
