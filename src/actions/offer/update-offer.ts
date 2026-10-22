"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";
import type { Offer } from "@/type/schema";
import type { OfferDraft } from "./add-offer";

export default async function updateOffer(
  offerId: string,
  values: OfferDraft,
): Promise<ApiResponse<Offer>> {
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/offers/${offerId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

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
      message: result.message || "Offer updated",
      data: result.data,
    };
  } catch (err) {
    console.error("[updateOffer]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
