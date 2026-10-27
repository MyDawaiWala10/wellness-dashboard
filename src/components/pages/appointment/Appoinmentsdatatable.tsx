"use client";
import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
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
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import AppointmentDetailDrawer from "./appointments-detail-page";
import { slotBookingZodType } from "@/type/schema";

interface AppointmentDataType<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Every visit, including ones shown inside their booking (defaults to data). */
  allAppointments?: TData[];
  /** Starting sort (defaults to newest booking first). */
  defaultSorting?: SortingState;
}

// Columns to hide on mobile (less critical for quick scanning)
const MOBILE_HIDDEN_IDS = [
  "createdAt",
  "bookingId",
  "age",
  "email",
  "note",
  "addOns",
  "location",
];

export function AppointmentDataTable<TData, TValue>({
  columns,
  data,
  allAppointments,
  defaultSorting = [{ id: "createdAt", desc: true }],
}: AppointmentDataType<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [selected, setSelected] = React.useState<TData | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Auto-hide columns on mobile
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = (matches: boolean) => {
      setColumnVisibility((prev) => {
        const next = { ...prev };
        MOBILE_HIDDEN_IDS.forEach((id) => {
          if (matches) next[id] = false;
          else delete next[id];
        });
        return next;
      });
    };
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
    return () => mq.removeEventListener("change", (e) => apply(e.matches));
  }, []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // reset filters
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <>
      <div className="flex flex-col gap-6 p-3">
        <div>
          <div className="flex items-center py-4 flex-wrap">
            <Input
              placeholder="Filter names..."
              value={
                (table.getColumn("name")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="max-w-sm mb-2 md:mb-0"
            />
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => table.resetColumnFilters()}
                className="h-8 px-2 lg:px-3 flex justify-center items-center gap-2"
              >
                Reset
                <X width={16} />
              </Button>
            )}
            <DataTableViewOptions table={table} />
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelected(row.original);
                        setDetailOpen(true);
                      }}
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
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <DataTablePagination table={table} />
      </div>

      <AppointmentDetailDrawer
        data={selected as slotBookingZodType | null}
        allAppointments={((allAppointments ?? data) as slotBookingZodType[]) ?? []}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelected(null);
        }}
      />
    </>
  );
}
