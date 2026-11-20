// A read: runs in the browser through the dashboard's GET route (lib/api-get.ts),
// so it never queues behind other requests the way a Server Action does.
import { apiGet } from "@/lib/api-get";
import type { ApiResponse } from "@/type/api";
import type { InvoicePaymentStatus, InvoiceType, PersistedInvoice } from "@/type/invoice";

export async function getAllInvoices(args?: {
  q?: string;
  type?: InvoiceType;
  paymentStatus?: InvoicePaymentStatus;
  /** Mongo _id of a booking, to fetch just that booking's invoice. */
  appointmentId?: string;
}): Promise<ApiResponse<PersistedInvoice[]>> {
  const params = new URLSearchParams();
  if (args?.q) params.set("q", args.q);
  if (args?.type) params.set("type", args.type);
  if (args?.paymentStatus) params.set("paymentStatus", args.paymentStatus);
  if (args?.appointmentId) params.set("appointment_id", args.appointmentId);
  const qs = params.toString();
  const res = await apiGet<PersistedInvoice[]>(`invoices${qs ? `?${qs}` : ""}`);
  return res.success ? { ...res, data: res.data ?? [] } : res;
}
