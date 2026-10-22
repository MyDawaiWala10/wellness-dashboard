"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";
import type { Offer } from "@/type/schema";

/** Create/update payload: the editable slice of an Offer (server owns the rest). */
export type OfferDraft = Partial<Omit<Offer, "_id" | "offerId" | "usedCount" | "createdBy">> &
  Pick<Offer, "name" | "kind" | "amount">;

export default async function addOffer(
  values: OfferDraft,
): Promise<ApiResponse<Offer>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message:
          result.message ?? `Request failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Offer added",
      data: result.data,
    };
  } catch (err) {
    console.error("[addOffer]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
