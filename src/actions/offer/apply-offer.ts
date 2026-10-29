"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";

export type ApplyOfferInput = {
  bookingId: string;
  /** Identify the offer by id, or by promo `code` (id wins if both). */
  offerId?: string;
  code?: string;
  /** Which priced line: the booking's own money (main/course) or an add-on. */
  lineKind?: "main" | "course" | "add_on";
  /** Required for lineKind "add_on" - the add-on key (serviceId|recommendedAt). */
  addonKey?: string;
  note?: string;
  /** Apply a once-per-phone offer again (Admin / Super Admin, with a note). */
  repeat?: boolean;
};

export type ApplyOfferResult = {
  off: number;
  final: number;
  booking: unknown;
};

/**
 * Ask the server to apply an offer to one priced line of a booking. The client
 * never sends a price - the server recomputes the rupees and re-checks every
 * rule (see lib/offers.ts + qoder-discount.md §4.4).
 */
export default async function applyOffer(
  input: ApplyOfferInput,
): Promise<ApiResponse<ApplyOfferResult>> {
  const { bookingId, ...body } = input;
  try {
    const response = await fetchWithAuth(
      `${base_url}/api/offers/booking/${bookingId}/apply`,
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
        code: result.code,
      };
    }
    return {
      success: true,
      message: result.message || "Offer applied",
      data: result.data,
    };
  } catch (err) {
    console.error("[applyOffer]", err);
    return { success: false, message: "Network error, please try again" };
  }
}
