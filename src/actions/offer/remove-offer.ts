"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";

export type RemoveOfferInput = {
  bookingId: string;
  lineKind?: "main" | "course" | "add_on";
  /** Required for lineKind "add_on". */
  addonKey?: string;
};

/**
 * Remove the offer currently applied to one priced line, restoring the line's
 * base price. Frees the offer's redemption (usedCount).
 */
export default async function removeOffer(
  input: RemoveOfferInput,
): Promise<ApiResponse<unknown>> {
  const { bookingId, ...body } = input;
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/offers/booking/${bookingId}/remove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message: result.message ?? `Request failed with status ${response.status}`,
      };
    }
    return { success: true, message: result.message || "Offer removed", data: result.data };
  } catch (err) {
    console.error("[removeOffer]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
