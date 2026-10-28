"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * Downloads an invoice's PDF. The server builds it fresh on every click, so it
 * always shows the current amounts; nothing is stored or shared as a link.
 * Office roles only: the invoice routes refuse therapists.
 */
export function InvoiceDownloadButton({
  invoiceId,
  className,
}: {
  /** No invoice yet → the button stays disabled and says so. */
  invoiceId?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!invoiceId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, { cache: "no-store" });
      // An expired login is redirected to the login page, which comes back as a
      // 200 HTML page; only a real PDF is saved.
      if (!res.ok || !res.headers.get("Content-Type")?.includes("application/pdf")) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { message?: string }).message || "Couldn't get the invoice PDF. Try logging in again.");
        return;
      }
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = `${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error("Network error, please try again");
    } finally {
      setBusy(false);
    }
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
