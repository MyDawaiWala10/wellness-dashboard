"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { X } from "lucide-react";
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

import {
  computeServiceStats,
  useGetServices,
} from "@/data/service/service";
import type { ServiceType } from "@/type/schema";
import { ServiceColumns } from "./services-columns";
import { AddServiceForm } from "./add-service-form";
import { ServiceDetailDrawer } from "./service-detail-drawer";
import { SessionRatesCard } from "./session-rates-card";
import { OffersCard } from "./offers-card";
import { MetricCard } from "@/components/metric-card";

export default function ServicesPage() {
  const {
    data: services = [],
    isLoading,
    isLoadingError: isError,
    error,
    refetch,
  } = useGetServices();

  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [openService, setOpenService] = useState<ServiceType | null>(null);

  const stats = useMemo(() => computeServiceStats(services), [services]);

  const table = useReactTable({
    data: services,
    columns: ServiceColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _columnId, value) => {
      const q = String(value).toLowerCase().trim();
      if (!q) return true;
      const s = row.original;
      return (
        s.name.toLowerCase().includes(q) ||
        s.serviceId.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.hsnCode ?? "").toLowerCase().includes(q)
      );
    },
    state: { sorting, columnFilters, columnVisibility, globalFilter: search },
    initialState: { pagination: { pageSize: 10 } },
  });

  const isFiltered = columnFilters.length > 0;

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The catalog of wellness services you offer.
        </p>
      </div>

      <QueryWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        skeleton={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border rounded-xl p-5 h-28 bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard label="Total Services" value={stats.totalServices} />
          <MetricCard
            label="Reduced add-on price"
            value={stats.withDiscount}
          />
        </div>
      </QueryWrapper>

      <SessionRatesCard />

      <OffersCard />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>All services</CardTitle>
            <CardDescription>
              Click the menu on a row to edit or remove a service.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RefreshButton
              onClick={() => refetch()}
              isFetching={isLoading}
              withText
            />
            <AddServiceForm />
          </div>
        </CardHeader>

        <CardContent>
          <QueryWrapper
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={refetch}
            skeleton={
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            }
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 flex-wrap">
              <Input
                placeholder="Search name, ID, HSN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => table.resetColumnFilters()}
                  className="h-8 px-2 lg:px-3"
                >
                  Reset
                  <X className="ml-1 h-4 w-4" />
                </Button>
              )}
              <div className="sm:ml-auto">
                <DataTableViewOptions table={table} />
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
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
                        onClick={() => setOpenService(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
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
                        colSpan={ServiceColumns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {services.length === 0
                          ? "No services yet - add your first one."
                          : "No services match your filters."}
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

      <ServiceDetailDrawer
        service={openService}
        onClose={() => setOpenService(null)}
      />
    </div>
  );
}
