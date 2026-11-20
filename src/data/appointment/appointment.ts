"use client";

import addAppointments from "@/actions/appointments/book-appointment";
import addAppointmentRecommendation, {
  type AddRecommendationInput,
} from "@/actions/appointments/add-appointment-recommendation";
import confirmAppointmentRecommendation from "@/actions/appointments/confirm-appointment-recommendation";
import completeSession from "@/actions/appointments/complete-session";
import recordPayment from "@/actions/appointments/record-payment";
import deleteAppointment from "@/actions/appointments/delete-appointments";
import updateAppointment from "@/actions/appointments/update-appointment";
import { slotBookingZodType, UserType } from "@/type/schema";
import { dedupePackageAppointments } from "@/lib/package-progress";
import { enquiriesQueryOptions } from "@/data/enquiry/enquiry";
import { apiGet } from "@/lib/api-get";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleAuthError } from "@/lib/auth-error-handler";
import { markOwnBooking } from "@/lib/own-bookings";

/**
 * The Bookings view: records with a service, a slot or a therapist (bare leads
 * stay on Enquiries), without recommended add-on stubs, packages folded.
 */
function appointmentRows(records: slotBookingZodType[]): slotBookingZodType[] {
  const filtered = records.filter(
    (r) =>
      (r.status !== "enquiry" ||
        Boolean(r.typeOfappointment) ||
        Boolean(r.service) ||
        Boolean(r.physioSlot?.date && r.physioSlot?.time) ||
        Boolean(r.slot?.date && r.slot?.time) ||
        Boolean(r.consultationSlot?.date && r.consultationSlot?.time)) &&
      r.appointmentKind !== "recommended",
  );
  return dedupePackageAppointments(filtered);
}

/** Bookings read the shared bookings list (one download for every view), shown as appointmentRows. */
export const appointmentsQueryOptions = (user: UserType) => ({
  ...enquiriesQueryOptions(user),
  select: appointmentRows,
});

export function useGetAllAppointments(user: UserType) {
  return useQuery(appointmentsQueryOptions(user));
}

// Appointments and enquiries are the same backend collection, so any
// mutation must invalidate both query keys - otherwise edits made from
// the enquiries drawer won't refresh the enquiries page (and vice versa).
// Invoices are also invalidated because confirming/paying an add-on,
// completing a session, or editing an appointment all re-sync its invoice
// on the backend - the invoices list must refresh to show it.
export function invalidateAppointmentAndEnquiryQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["appointments"] });
  queryClient.invalidateQueries({ queryKey: ["enquiries"] });
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  // Therapist detail drawer shows earnings via useGetPersonalAppointments;
  // keep that in sync whenever an appointment is mutated from any view.
  queryClient.invalidateQueries({ queryKey: ["getPersonalAppointments"] });
  // A payment (cash especially) or a completed session moves therapist balances.
  queryClient.invalidateQueries({ queryKey: ["payout-balances"] });
}

/**
 * Keeps each open tab's bookings current without re-downloading the whole list
 * on a timer: checks a tiny version (how many bookings, newest change) every
 * 10 s and reloads the lists only when it moves. It keeps running in hidden
 * tabs (a few bytes each time) so the new-booking sound still plays there.
 */
export function useBookingsVersionWatch(user: { id?: string; role?: string } | null | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const { data: version } = useQuery({
    queryKey: ["bookings-version", user?.id, user?.role] as const,
    queryFn: async ({ signal }) => {
      const res = await apiGet<{ version: string }>("appointments/version", { signal });
      if (!res.success) throw new Error(res.message);
      return res.data?.version ?? "";
    },
    enabled: enabled && !!user?.id,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!version) return;
    // ponytail: this tab's own saves move the version too, so the list reloads
    // once more after them. Worth skipping once the list is slimmed (#5) if it shows.
    if (seen.current !== undefined && seen.current !== version) invalidateAppointmentAndEnquiryQueries(queryClient);
    seen.current = version;
  }, [version, queryClient]);
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (values: slotBookingZodType) => {
      const result = await addAppointments(values);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: (result, values) => {
      markOwnBooking(result.data);
      // Without a therapist it waits on Enquiries (step 5), not Appointments.
      toast.success("Appointment booked", {
        description: values.doctorId
          ? result.message
          : "No therapist yet - it's on Enquiries until one is assigned.",
      });
      invalidateAppointmentAndEnquiryQueries(queryClient);
    },
    onError: (err: Error) => {
      if (handleAuthError(err, router)) return;
      toast.error(err.message);
    },
  });
}

function patchAppointmentInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  appointmentId: string,
  patch: slotBookingZodType,
) {
  // Same backend collection behind both lists, so patch both - an open
  // enquiry drawer reads the enquiries list.
  for (const key of ["appointments", "enquiries"]) {
    queryClient.setQueriesData<slotBookingZodType[]>({ queryKey: [key] }, (old) => {
      if (!old) return old;
      return old.map((a) => (a._id === appointmentId ? { ...a, ...patch } : a));
    });
  }
}

export function useAddAppointmentRecommendation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      values,
    }: {
      appointmentId: string;
      values: AddRecommendationInput;
    }) => {
      const result = await addAppointmentRecommendation(appointmentId, values);
      if (!result.success) throw new Error(result.message);
      return { ...result, appointmentId };
    },
    onSuccess: (result) => {
      if (result.data && result.appointmentId) {
        patchAppointmentInCache(queryClient, result.appointmentId, result.data);
      }
      toast.success("Add-on stacked on visit", { description: result.message });
      invalidateAppointmentAndEnquiryQueries(queryClient);
    },
    onError: (err: Error) => {
      if (handleAuthError(err, router)) return;
      toast.error(err.message);
    },
  });
}

export function useConfirmAppointmentRecommendation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      serviceId,
      recommendedAt,
      code,
    }: {
      appointmentId: string;
      serviceId: string;
      recommendedAt: string;
      /** The customer's consent code - the server refuses without it. */
      code: string;
    }) => {
      const result = await confirmAppointmentRecommendation(appointmentId, {
        serviceId,
        recommendedAt,
        code,
      });
      if (!result.success) throw new Error(result.message);
      return { ...result, appointmentId };
    },
    onSuccess: (result) => {
      if (result.data && result.appointmentId) {
        patchAppointmentInCache(queryClient, result.appointmentId, result.data);
      }
      toast.success("Add-on confirmed", { description: result.message });
      invalidateAppointmentAndEnquiryQueries(queryClient);
    },
    onError: (err: Error) => {
      if (handleAuthError(err, router)) return;
      toast.error(err.message);
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      note,
      performed,
    }: {
      appointmentId: string;
      note?: string;
      /** "Service performed" is ticked (its own save may still be on the way). */
      performed?: boolean;
    }) => {
      const result = await completeSession(appointmentId, note, performed);
      if (!result.success) throw new Error(result.message);
      return { ...result, appointmentId };
    },
    onMutate: async ({ appointmentId }) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      await queryClient.cancelQueries({ queryKey: ["enquiries"] });

      const previousAppointments = queryClient.getQueryData(["appointments"]);
      const previousEnquiries = queryClient.getQueryData(["enquiries"]);

      // Optimistically mark session as complete
      queryClient.setQueriesData<slotBookingZodType[]>(
        { queryKey: ["appointments"] },
        (old) => {
          if (!old) return old;
          return old.map((a) => {
            if (a._id !== appointmentId) return a;
            return { ...a, sessionCompleted: true };
          });
        },
      );
      queryClient.setQueriesData<slotBookingZodType[]>(
        { queryKey: ["enquiries"] },
        (old) => {
          if (!old) return old;
          return old.map((a) => {
            if (a._id !== appointmentId) return a;
            return { ...a, sessionCompleted: true };
          });
        },
      );

      return { previousAppointments, previousEnquiries };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
      if (context?.previousEnquiries) {
        queryClient.setQueryData(["enquiries"], context.previousEnquiries);
      }
      if (handleAuthError(_err, router)) return;
      toast.error(_err.message);
    },
    onSettled: () => {
      invalidateAppointmentAndEnquiryQueries(queryClient);
    },
    onSuccess: (result) => {
      if (result.data && result.appointmentId) {
        patchAppointmentInCache(queryClient, result.appointmentId, result.data);
      }
      toast.success(result.message);
    },
  });
}

/** Record money received (part or full) against a booking. */
export function useRecordPayment() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (v: { appointmentId: string; amount: number; method: string; addon?: string }) => {
      const result = await recordPayment(v.appointmentId, v.amount, v.method, v.addon);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onError: (err: Error) => {
      if (handleAuthError(err, router)) return;
      toast.error(err.message);
    },
    onSuccess: (result) => {
      // The money may sit on a course's first row, not the row on screen.
      if (result.data?._id) patchAppointmentInCache(queryClient, result.data._id, result.data);
      toast.success(result.message);
    },
    onSettled: () => invalidateAppointmentAndEnquiryQueries(queryClient),
  });
}


export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteAppointment(id);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      await queryClient.cancelQueries({ queryKey: ["enquiries"] });

      const previousAppointments = queryClient.getQueryData(["appointments"]);
      const previousEnquiries = queryClient.getQueryData(["enquiries"]);

      // Optimistically remove from cache
      queryClient.setQueriesData<slotBookingZodType[]>(
        { queryKey: ["appointments"] },
        (old) => old?.filter((a) => a._id !== id) ?? old,
      );
      queryClient.setQueriesData<slotBookingZodType[]>(
        { queryKey: ["enquiries"] },
        (old) => old?.filter((a) => a._id !== id) ?? old,
      );

      return { previousAppointments, previousEnquiries };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
      if (context?.previousEnquiries) {
        queryClient.setQueryData(["enquiries"], context.previousEnquiries);
      }
      if (handleAuthError(_err, router)) return;
      toast.error(_err.message);
    },
    onSettled: () => {
      invalidateAppointmentAndEnquiryQueries(queryClient);
    },
    onSuccess: (result) => {
      toast.success("Appointment cancelled", { description: result.message });
    },
  });
}

export function useUpdateAppointment(opts?: { silent?: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (values: slotBookingZodType) => {
      const result = await updateAppointment(values);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async (newValues) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      await queryClient.cancelQueries({ queryKey: ["enquiries"] });

      // Snapshot current data for rollback
      const previousAppointments = queryClient.getQueryData(["appointments"]);
      const previousEnquiries = queryClient.getQueryData(["enquiries"]);

      // Optimistically update the cache immediately
      queryClient.setQueriesData<slotBookingZodType[]>(
        { queryKey: ["appointments"] },
        (old) => {
          if (!old) return old;
          return old.map((a) => (a._id === newValues._id ? { ...a, ...newValues } : a));
        },
      );
      queryClient.setQueriesData<slotBookingZodType[]>(
        { queryKey: ["enquiries"] },
        (old) => {
          if (!old) return old;
          return old.map((a) => (a._id === newValues._id ? { ...a, ...newValues } : a));
        },
      );

      // Return snapshot for rollback on error
      return { previousAppointments, previousEnquiries };
    },
    onError: (err: Error, _variables, context) => {
      // Rollback to snapshot on error
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
      if (context?.previousEnquiries) {
        queryClient.setQueryData(["enquiries"], context.previousEnquiries);
      }
      if (handleAuthError(err, router)) return;
      toast.error(err.message || "Update failed");
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      invalidateAppointmentAndEnquiryQueries(queryClient);
    },
    onSuccess: (result) => {
      // Server truth straight into both lists (price, payments...), so an
      // open drawer doesn't wait for the refetch.
      if (result.data?._id) patchAppointmentInCache(queryClient, result.data._id, result.data);
      // Auto-save callers (e.g. the enquiry drawer) pass silent:true and show
      // an inline "Saved" indicator instead of a toast on every blur/toggle.
      if (!opts?.silent) {
        toast.success("Appointment updated", { description: result.message });
      }
    },
  });
}

// ── Therapist session counts ──────────────────────────────────────────────────
import getTherapistSessionCounts, {
  type TherapistSessionCount,
} from "@/actions/appointments/get-therapist-session-counts";

export function useGetTherapistSessionCounts() {
  return useQuery({
    queryKey: ["therapist-session-counts"],
    queryFn: async () => {
      const result = await getTherapistSessionCounts();
      if (!result.success) throw new Error(result.message);
      return (result.data ?? []) as TherapistSessionCount[];
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000, // 1 minute
    retry: 3,
  });
}