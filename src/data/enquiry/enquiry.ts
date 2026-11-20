"use client";

import createEnquiry, {
  type CreateEnquiryInput,
} from "@/actions/enquiries/create-enquiry";
import getAllAppointments from "@/actions/appointments/get-all-appointments";
import type { EnquiryType, UserType } from "@/type/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markOwnBooking } from "@/lib/own-bookings";

const OPEN_STATUSES = new Set<NonNullable<EnquiryType["status"]>>([
  "enquiry",
  "scheduled",
  "ongoing",
]);

export const enquiriesQueryOptions = (user: UserType) => ({
  queryKey: ["enquiries", user?.id, user?.role, user?.userEmail] as const,
  queryFn: async (): Promise<EnquiryType[]> => {
    const result = await getAllAppointments();
    if (!result.success) throw new Error(result.message);
    return (result.data ?? []) as EnquiryType[];
  },
  // The one bookings list, shared by Enquiries, Bookings (appointmentsQueryOptions),
  // Customers and the new-booking alert. No timer: useBookingsVersionWatch checks
  // a tiny version every 10 s and reloads this only when a booking changed;
  // saves invalidate it directly (ISSUES #66).
  refetchOnWindowFocus: false,
  staleTime: 60 * 1000,
  // Ride out short network drops before calling the load failed.
  retry: 3,
});

export function useGetAllEnquiries(user: UserType) {
  return useQuery(enquiriesQueryOptions(user));
}

export function findOpenEnquiryByPhone(
  records: EnquiryType[] | undefined,
  phonenumber: number,
): EnquiryType | undefined {
  if (!records) return undefined;
  return records.find(
    (r) =>
      r.phonenumber === phonenumber &&
      r.status !== undefined &&
      OPEN_STATUSES.has(r.status),
  );
}

export function useCreateEnquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreateEnquiryInput) => {
      const result = await createEnquiry(values);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: (result) => {
      markOwnBooking(result.data);
      toast.success("Enquiry created", { description: result.message });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
