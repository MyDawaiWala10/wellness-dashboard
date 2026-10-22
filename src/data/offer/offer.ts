"use client";

/**
 * Offers data layer - talks to the real backend (/api/offers).
 *
 * Reads are open to any signed-in dashboard user (the booking form needs the
 * list to build its "Apply offer" dropdown); create / edit / delete are
 * Super-Admin only, enforced on the server and mirrored in the UI. Applying /
 * removing an offer on a booking is an office action - the SERVER does all the
 * money math, so nothing here sends a price.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Offer } from "@/type/schema";
import { getAllOffers } from "@/actions/offer/get-all-offers";
import addOffer, { type OfferDraft } from "@/actions/offer/add-offer";
import updateOffer from "@/actions/offer/update-offer";
import deleteOffer from "@/actions/offer/delete-offer";
import applyOffer, { type ApplyOfferInput } from "@/actions/offer/apply-offer";
import removeOffer, { type RemoveOfferInput } from "@/actions/offer/remove-offer";

export function useGetOffers() {
  return useQuery({
    queryKey: ["offers"],
    queryFn: async (): Promise<Offer[]> => {
      const result = await getAllOffers();
      if (!result.success) throw new Error(result.message);
      return (result.data ?? []) as Offer[];
    },
    refetchOnWindowFocus: false,
  });
}

export function useAddOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: OfferDraft) => {
      const result = await addOffer(values);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Offer added");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ offerId, values }: { offerId: string; values: OfferDraft }) => {
      const result = await updateOffer(offerId, values);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Offer updated");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const result = await deleteOffer(offerId);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      toast.success("Offer deleted");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Apply an offer to one priced line of a booking. Invalidates offers (usedCount) + bookings. */
export function useApplyOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplyOfferInput) => {
      const result = await applyOffer(input);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      if (data) toast.success(`Offer applied −₹${data.off}`);
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Remove the offer on a booking line, restoring its base price. */
export function useRemoveOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RemoveOfferInput) => {
      const result = await removeOffer(input);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      toast.success("Offer removed");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
