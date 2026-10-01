"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import getClinicSettings, { type ClinicSettings } from "@/actions/clinic-settings/get-clinic-settings";
import updateClinicSettings from "@/actions/clinic-settings/update-clinic-settings";

const DEFAULT: ClinicSettings = { bookingGapMinutes: 60 };

export function useGetClinicSettings() {
  return useQuery({
    queryKey: ["clinic-settings"],
    queryFn: async (): Promise<ClinicSettings> => {
      const result = await getClinicSettings();
      if (!result.success) throw new Error(result.message);
      return result.data ?? DEFAULT;
    },
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUpdateClinicSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<ClinicSettings>) => {
      const result = await updateClinicSettings(updates);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
