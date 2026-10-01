"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import type { ApiResponse } from "@/type/api";
import type { InvoicePaymentStatus, InvoiceType, PersistedInvoice } from "@/type/invoice";

export async function getAllInvoices(args?: {
  q?: string;
  type?: InvoiceType;
  paymentStatus?: InvoicePaymentStatus;
  /** Mongo _id of a booking, to fetch just that booking's invoice. */
  appointmentId?: string;
}): Promise<ApiResponse<PersistedInvoice[]>> {
  try {
    const params = new URLSearchParams();
    if (args?.q) params.set("q", args.q);
    if (args?.type) params.set("type", args.type);
    if (args?.paymentStatus) params.set("paymentStatus", args.paymentStatus);
    if (args?.appointmentId) params.set("appointment_id", args.appointmentId);

    const qs = params.toString();
    const url = `${base_url}/api/invoices${qs ? `?${qs}` : ""}`;

    const response = await fetchWithAuth(url, { method: "GET", cache: "no-store" });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: (result as any).message ?? `Request failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message ?? "Invoices fetched successfully",
      data: (result.data ?? []) as PersistedInvoice[],
    };
  } catch {
    return { success: false, message: "Network error, please try again" };
  }
}

