"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { RefreshButton } from "@/components/refresh-button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/tables/data-table-pagination";
import { DataTableViewOptions } from "@/components/tables/data-table-view-options";
import { QueryWrapper } from "@/components/query-wrapper";
import { useGetInvoices } from "@/data/invoice/invoice";
import type { PersistedInvoice } from "@/type/invoice";
import { makeInvoiceColumns } from "./invoices-columns";
import { InvoiceDetailDrawer } from "./invoice-detail-drawer";
import {
  CreateInvoiceSheet,
  CreateInvoiceTrigger,
} from "./create-invoice-sheet";

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export default function InvoicesPage() {
  const {
    data: invoices = [],
    isLoading,
    isFetching,
    isLoadingError: isError,
    error,
    refetch,
  } = useGetInvoices();

  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const openInvoice: PersistedInvoice | null = useMemo(() => {
    if (!openInvoiceId) return null;
    return invoices.find((i) => i.invoice_id === openInvoiceId) ?? null;
  }, [invoices, openInvoiceId]);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  // Customer ID is a precise cross-ref, not everyday scanning — hidden by
  // default, toggle it on via the View menu.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    customer_id: false,
  });

  const columns = useMemo(
    () =>
      makeInvoiceColumns({
        onOpenDetail: (inv) => setOpenInvoiceId(inv.invoice_id),
      }),
    [],
  );

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
      globalFilter: search,
    },
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _columnId, value) => {
      const q = String(value).toLowerCase().trim();
      if (!q) return true;
      const r = row.original;
      return (
        (r.invoice_id ?? "").toLowerCase().includes(q) ||
        (r.enquiry_id ?? "").toLowerCase().includes(q) ||
        (r.customer_id ?? "").toLowerCase().includes(q) ||
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        String(r.customer_phone ?? "").includes(q)
      );
    },
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated invoices created when sessions are marked complete.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>All invoices</CardTitle>
              <CardDescription>Click an invoice to view/edit and generate PDF.</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CreateInvoiceTrigger onOpen={() => setCreateOpen(true)} />
              <RefreshButton
                onClick={() => refetch()}
                isFetching={isFetching}
                label="Refresh invoices"
              />
            </div>
          </CardHeader>

          <CardContent>
            <QueryWrapper
              isLoading={isLoading}
              isError={isError}
              error={error}
              onRetry={refetch}
              skeleton={<TableSkeleton />}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <Input
                  placeholder="Search invoice / enquiry / customer ID, name, phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                />
                {search && (
                  <Button variant="ghost" onClick={() => setSearch("")}>
                    Clear
                  </Button>
                )}
                <div className="sm:ml-auto">
                  <DataTableViewOptions table={table} />
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => setOpenInvoiceId(row.original.invoice_id)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              onClick={(e) => {
                                // Keep action-cell button click from bubbling twice.
                                if (cell.column.id === "action") e.stopPropagation();
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center text-muted-foreground"
                        >
                          {invoices.length === 0
                            ? "No invoices yet - mark a session complete to generate one."
                            : "No invoices match your search."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4">
                <DataTablePagination table={table} />
              </div>
            </QueryWrapper>
          </CardContent>
        </Card>
      </div>

      <InvoiceDetailDrawer
        invoice={openInvoice}
        onClose={() => setOpenInvoiceId(null)}
      />

      <CreateInvoiceSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setOpenInvoiceId(id)}
      />
    </>
  );
}

