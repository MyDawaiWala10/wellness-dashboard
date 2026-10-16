/**
 * What an invoice's payment state reads as. The stored status is only paid or
 * pending, so a pending invoice with money already in reads "Part paid".
 * Mirrors the PDF's label (WellnessBackend lib/invoicePdf.ts).
 */
export function invoiceStatusLabel(invoice: {
  payment_status?: string;
  advance_paid?: number;
}): "Paid" | "Part paid" | "Pending" {
  if (invoice.payment_status === "paid") return "Paid";
  return (invoice.advance_paid ?? 0) > 0 ? "Part paid" : "Pending";
}
