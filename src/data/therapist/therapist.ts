"use client";

import addTherapist from "@/actions/therapist/add-therapist";
import deleteTherapist from "@/actions/therapist/delete-therapist";
import deleteTherapistSuperAdmin from "@/actions/therapist/delete-therapist-super-admin";
import updateTherapistSuperAdmin from "@/actions/therapist/update-therapist-super-admin";
import { getAllTherapist } from "@/actions/therapist/get-all-therapist";
import getPersonalAppointments from "@/actions/therapist/get-personal-appointments";
import updateTherapist from "@/actions/therapist/update-therapist";
import { TherapistformType } from "@/type/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/providers/permission-provider";

export const therapistQueryOptions = {
  queryKey: ["therapists"],
  queryFn: async () => {
    const result = await getAllTherapist();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },
  refetchOnWindowFocus: false,
};

export function useGetAllTherapist() {
  return useQuery(therapistQueryOptions);
}

export function useAddTherapist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: TherapistformType) => {
      const result = await addTherapist(values);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Therapist added successfully");
      queryClient.invalidateQueries({ queryKey: ["therapists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTherapist() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return useMutation({
    mutationFn: async (id: string) => {
      const result = isSuperAdmin
        ? await deleteTherapistSuperAdmin(id)
        : await deleteTherapist(id);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["therapists"] });

      const previousTherapists = queryClient.getQueryData(["therapists"]);

      // Optimistically remove from cache
      queryClient.setQueryData(["therapists"], (old: any[]) => {
        if (!old) return old;
        return old.filter((t) => t._id !== id);
      });

      return { previousTherapists };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTherapists) {
        queryClient.setQueryData(["therapists"], context.previousTherapists);
      }
      toast.error(_err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["therapists"] });
    },
    onSuccess: () => {
      toast.success("Therapist deleted successfully");
    },
  });
}

export function useUpdateTherapist() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return useMutation({
    mutationFn: async (values: TherapistformType) => {
      const result = isSuperAdmin
        ? await updateTherapistSuperAdmin(values)
        : await updateTherapist(values);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async (newValues) => {
      await queryClient.cancelQueries({ queryKey: ["therapists"] });

      const previousTherapists = queryClient.getQueryData(["therapists"]);

      // Optimistically update the cache
      queryClient.setQueryData(["therapists"], (old: any[]) => {
        if (!old) return old;
        return old.map((t) =>
          t.doctorId === newValues.doctorId ? { ...t, ...newValues } : t,
        );
      });

      return { previousTherapists };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTherapists) {
        queryClient.setQueryData(["therapists"], context.previousTherapists);
      }
      toast.error(_err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["therapists"] });
    },
    onSuccess: () => {
      toast.success("Therapist updated successfully");
    },
  });
}

export function useGetPersonalAppointments(id: string) {
  return useQuery({
    queryKey: ["getPersonalAppointments", id],
    queryFn: async () => {
      const result = await getPersonalAppointments(id);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: !!id,
  });
}
