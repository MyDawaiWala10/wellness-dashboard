"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import generateInvoicePdf from "@/actions/invoices/generate-invoice-pdf";
import { cn } from "@/lib/utils";

/**
 * Opens an invoice's PDF. The server hands back the current PDF, or makes a
 * fresh one first when the numbers changed since (it marks the PDF out of date
 * then), so it never shows old amounts. Office roles only: the invoice routes
 * refuse therapists.
 */
export function InvoiceDownloadButton({
  invoiceId,
  className,
}: {
  /** No invoice yet → the button stays disabled and says so. */
  invoiceId?: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!invoiceId || busy) return;
    // Opened inside the click so the browser doesn't block it as a pop-up; the
    // PDF's address is filled in once it's ready.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    const result = await generateInvoicePdf(invoiceId);
    setBusy(false);
    const url = result.success ? result.data?.pdf_url : undefined;
    if (!url) {
      tab?.close();
      toast.error(result.message || "Couldn't get the invoice PDF");
      return;
    }
    if (tab) tab.location.href = url;
    else window.location.href = url;
    // A freshly made PDF is now on file.
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  const label = invoiceId ? "Download invoice PDF" : "No invoice yet";
  return (
    <button
      type="button"
      onClick={download}
      disabled={!invoiceId || busy}
      title={label}
      aria-label={label}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md border text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  );
}
