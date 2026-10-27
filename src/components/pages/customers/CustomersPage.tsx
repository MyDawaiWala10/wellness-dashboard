"use client";

import { ResizableCell, ResizableHead, useColumnWidths } from "@/components/tables/resizable-columns";
import { matchesSearch } from "@/lib/search";
import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/tables/data-table-pagination";
import { DataTableViewOptions } from "@/components/tables/data-table-view-options";
import { QueryWrapper } from "@/components/query-wrapper";

import { useAuthStore } from "@/providers/permission-provider";
import {
  computeCustomerTodayStats,
  useGetCustomers,
  type Customer,
} from "@/data/customer/customer";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";

import { makeCustomerColumns } from "./customers-columns";
import { CustomerDetailDrawer } from "./customer-detail-drawer";

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border rounded-xl p-5 h-28 bg-muted/30 animate-pulse"
        />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function CustomerTodayCards({
  newCustomersToday,
  bookingsToday,
  returningToday,
}: ReturnType<typeof computeCustomerTodayStats>) {
  return (
    <MetricCardsRow>
      <MetricCard label="New customers today" value={newCustomersToday} />
      <MetricCard label="Bookings today" value={bookingsToday} />
      <MetricCard
        label="Returning today"
        value={returningToday}
        hint="Existing customers who booked again"
      />
    </MetricCardsRow>
  );
}

export default function CustomersPage() {
  const { user } = useAuthStore();
  const { id, role, userEmail } = user || {};
  const {
    data: customers = [],
    isLoading,
    isLoadingError: isError,
    error,
    refetch,
  } = useGetCustomers({ id, role, userEmail });

  const [openCustomer, setOpenCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    {},
  );

  const todayStats = useMemo(
    () => computeCustomerTodayStats(customers),
    [customers],
  );

  const columns = useMemo(
    () =>
      makeCustomerColumns({
        onOpenDetail: (c) => setOpenCustomer(c),
      }),
    [],
  );

  // Drag a header edge to resize; remembered per table in this browser.

  const cols = useColumnWidths("customers");

  const table = useReactTable({
    data: customers,
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
      const c = row.original;
      return matchesSearch(value, [c.customer_id, c.name, c.phonenumber, c.email, c.location]);
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  return (
    <>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everyone who has booked with you - each phone has a unique customer ID.
          </p>
        </div>

        <QueryWrapper
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          skeleton={<StatCardsSkeleton />}
        >
          <CustomerTodayCards {...todayStats} />
        </QueryWrapper>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>All customers</CardTitle>
              <CardDescription>
                Click a name or the menu to see full booking history.
              </CardDescription>
            </div>
            <RefreshButton
              onClick={() => refetch()}
              isFetching={isLoading}
              withText
            />
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
                  placeholder="Search name, phone, email, city…"
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
                <Table className="min-w-[700px]">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <ResizableHead key={header.id} header={header} cols={cols} />
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
                          onClick={() => setOpenCustomer(row.original)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <ResizableCell
                              key={cell.id}
                              onClick={(e) => {
                                if (cell.column.id === "action") {
                                  e.stopPropagation();
                                }
                              }}
                             cell={cell} cols={cols} />
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center text-muted-foreground"
                        >
                          {customers.length === 0
                            ? "No customers yet - they appear here once someone books."
                            : "No customers match your search."}
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

      <CustomerDetailDrawer
        customer={openCustomer}
        onClose={() => setOpenCustomer(null)}
      />
    </>
  );
}
