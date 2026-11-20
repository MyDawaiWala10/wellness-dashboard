"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAllTherapistLeaves, getTherapistLeaves } from "@/actions/therapist/get-therapist-leaves";
import {
  createTherapistLeave,
  deleteTherapistLeave,
  updateWeekOffDays,
  type TherapistLeave,
} from "@/actions/therapist/therapist-leaves";

export function useGetTherapistLeaves(doctorId: string) {
  return useQuery({
    queryKey: ["therapist-leaves", doctorId],
    queryFn: async () => {
      const result = await getTherapistLeaves(doctorId);
      if (!result.success) {
        toast.error(result.message ?? "Failed to load leaves");
        return [] as TherapistLeave[];
      }
      return result.data;
    },
    enabled: !!doctorId,
    retry: false,
  });
}

export function useGetAllTherapistLeaves(date?: string) {
  return useQuery({
    queryKey: ["all-therapist-leaves", date],
    queryFn: async () => {
      const result = await getAllTherapistLeaves(date);
      if (!result.success) {
        toast.error(result.message ?? "Failed to load leaves");
        return [] as TherapistLeave[];
      }
      return result.data;
    },
    retry: false,
  });
}

export function useCreateTherapistLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      doctorId: string;
      startDate: string;
      endDate?: string;
      reason?: string;
    }) => {
      const result = await createTherapistLeave(data);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["therapist-leaves", vars.doctorId] });
      qc.invalidateQueries({ queryKey: ["all-therapist-leaves"] });
      toast.success("Leave added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTherapistLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, doctorId }: { id: string; doctorId: string }) => {
      const result = await deleteTherapistLeave(id);
      if (!result.success) throw new Error(result.message);
      return { doctorId };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["therapist-leaves", vars.doctorId] });
      qc.invalidateQueries({ queryKey: ["all-therapist-leaves"] });
      toast.success("Leave removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWeekOffDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      doctorId,
      weekOffDays,
    }: {
      doctorId: string;
      weekOffDays: number[];
    }) => {
      const result = await updateWeekOffDays(doctorId, weekOffDays);
      if (!result.success) throw new Error(result.message);
      return { doctorId };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["therapists"] });
      qc.invalidateQueries({ queryKey: ["therapist-leaves", vars.doctorId] });
      toast.success("Weekly schedule updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
