"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/tables/data-table-column-header";
import type { PersistedInvoice, InvoicePaymentStatus, InvoiceType } from "@/type/invoice";
import { invoiceStatusLabel } from "@/lib/invoice-status";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

const TYPE_LABEL: Record<InvoiceType, string> = {
  package_purchase: "Package purchase",
  therapy_session: "Therapy session",
  therapy_addon_standalone: "Addon (standalone)",
  online_consultation: "Online consultation",
  vitals_subscription: "Vitals subscription",
};

const STATUS_CLASS: Record<InvoicePaymentStatus, string> = {
  paid: "border-green-600 text-green-700 bg-green-50",
  pending: "border-amber-600 text-amber-800 bg-amber-50",
};

function StatusBadge({ invoice }: { invoice: PersistedInvoice }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[invoice.payment_status]}>
      {invoiceStatusLabel(invoice)}
    </Badge>
  );
}

interface MakeInvoiceColumnsParams {
  onOpenDetail: (invoice: PersistedInvoice) => void;
}

export function makeInvoiceColumns({
  onOpenDetail,
}: MakeInvoiceColumnsParams): ColumnDef<PersistedInvoice>[] {
  return [
    {
      accessorKey: "invoice_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice ID" />
      ),
      cell: ({ row }) => (
        <button
          type="button"
          className="font-mono text-xs text-muted-foreground hover:underline text-left"
          onClick={() => onOpenDetail(row.original)}
        >
          {row.original.invoice_id}
        </button>
      ),
    },
    {
      accessorKey: "enquiry_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Enquiry ID" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.enquiry_id || "-"}
        </span>
      ),
    },
    {
      accessorKey: "customer_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customer_name}</span>
      ),
    },
    {
      accessorKey: "customer_id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer ID" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.customer_id || "-"}
        </span>
      ),
    },
    {
      accessorKey: "invoice_type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary">{TYPE_LABEL[row.original.invoice_type]}</Badge>
      ),
    },
    {
      id: "total",
      accessorFn: (r) => r.total,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{formatINR(row.original.total)}</span>
      ),
    },
    {
      id: "payment_status",
      accessorFn: (r) => r.payment_status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payment" />
      ),
      cell: ({ row }) => <StatusBadge invoice={row.original} />,
    },
    {
      id: "createdAt",
      accessorFn: (r) => r.createdAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => {
        const iso = row.original.createdAt;
        if (!iso) return <span className="text-muted-foreground/40">-</span>;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return <span className="text-muted-foreground/40">-</span>;
        return (
          <span className="text-xs text-muted-foreground whitespace-nowrap" title={d.toLocaleString()}>
            {formatDistanceToNow(d, { addSuffix: true })}
          </span>
        );
      },
    },
    {
      id: "action",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onOpenDetail(row.original)}
        >
          <span className="sr-only">Open invoice</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      ),
    },
  ];
}

