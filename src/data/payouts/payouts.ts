"use client";

/** Therapist balances and settlements - talks to /api/payouts. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recordSettlement, type PayoutBalance, type SettlementInput } from "@/actions/payouts/payouts";
import { getPayoutBalances } from "@/actions/payouts/get-payout-balances";

export function useGetPayoutBalances(enabled = true) {
  return useQuery({
    queryKey: ["payout-balances"],
    queryFn: async (): Promise<PayoutBalance[]> => {
      const result = await getPayoutBalances();
      if (!result.success) throw new Error(result.message);
      return result.data ?? [];
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useRecordSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettlementInput) => {
      const result = await recordSettlement(input);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: (_r, input) => {
      toast.success(input.direction === "paid" ? "Recorded: company paid the therapist" : "Recorded: therapist paid the company");
      queryClient.invalidateQueries({ queryKey: ["payout-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
