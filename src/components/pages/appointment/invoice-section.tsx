"use client";

import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useGenerateInvoicePdf,
  useInvoiceForAppointment,
} from "@/data/invoice/invoice";
import { useAuthStore } from "@/providers/permission-provider";
import { formatINR } from "@/components/pages/services/services-columns";

/**
 * The invoice this booking already raised, if any. Read-only on purpose:
 * editing and voiding live on the Invoices page, and duplicating them here
 * would mean two places that can change the same money.
 *
 * Invoices raise themselves once payment is recorded, so "not raised yet" is a
 * normal state for an unpaid booking rather than something to fix.
 */
export function InvoiceSection({ appointmentId }: { appointmentId?: string }) {
  const user = useAuthStore((s) => s.user);
  // Every invoice endpoint is back-office only, so asking as a therapist just
  // earns a 403 and an error toast. Don't ask.
  const isTherapist = user?.role === "THERAPIST";

  const { data: invoice, isLoading } = useInvoiceForAppointment(appointmentId, {
    enabled: !isTherapist,
  });
  const { mutate: generatePdf, isPending: isGenerating } = useGenerateInvoicePdf();

  if (isTherapist) return null;

  return (
    <section className="rounded-lg border p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Invoice
      </p>

      {isLoading ? (
        <p className="py-1 text-sm text-muted-foreground">Checking...</p>
      ) : !invoice ? (
        <p className="py-1 text-sm text-muted-foreground">
          Not raised yet - one is created automatically once payment is recorded.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-mono text-[13px] font-medium">
              {invoice.invoice_id}
            </span>
            {invoice.voided ? (
              <Badge variant="outline" className="text-[10px] text-red-600">
                Voided
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={
                  invoice.payment_status === "paid"
                    ? "text-[10px] text-emerald-600"
                    : "text-[10px] text-amber-600"
                }
              >
                {invoice.payment_status === "paid" ? "Paid" : "Pending"}
              </Badge>
            )}
            <span className="ml-auto font-mono text-[13px] font-semibold tabular-nums">
              {formatINR(invoice.total ?? 0)}
            </span>
          </div>

          {invoice.pdf_url ? (
            <Button
              asChild
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
            >
              <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={isGenerating}
              onClick={() => generatePdf({ invoiceId: invoice.invoice_id })}
            >
              {isGenerating ? "Generating..." : "Generate PDF"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
