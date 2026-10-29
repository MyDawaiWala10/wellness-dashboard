import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Downloads an invoice's PDF with a plain link, so the browser (or whatever
 * download manager is installed) just saves it. The server builds it fresh on
 * every click, so it always shows the current amounts; nothing is stored or
 * shared as a link. Office roles only: the invoice routes refuse therapists.
 */
export function InvoiceDownloadButton({
  invoiceId,
  className,
}: {
  /** No invoice yet → the button stays disabled and says so. */
  invoiceId?: string;
  className?: string;
}) {
  const label = invoiceId ? "Download invoice PDF" : "No invoice yet";
  const classes = cn(
    "grid h-8 w-8 shrink-0 place-items-center rounded-md border text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
    className,
  );
  const icon = <Download className="h-4 w-4" />;

  if (!invoiceId) {
    return (
      <button type="button" disabled title={label} aria-label={label} className={classes}>
        {icon}
      </button>
    );
  }
  return (
    <a
      href={`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`}
      // The server names the file (invoice number + customer name).
      download
      title={label}
      aria-label={label}
      className={classes}
    >
      {icon}
    </a>
  );
}
