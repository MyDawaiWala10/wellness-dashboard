"use client"
import { ResizableCell, ResizableHead, useColumnWidths } from "@/components/tables/resizable-columns";
import * as React from 'react'
import {
    ColumnDef,
    ColumnFiltersState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/tables/data-table-pagination";
import { DataTableViewOptions } from "@/components/tables/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/tables/data-table-faceted-filter";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';

interface AppointmentDataType<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onRowClick?: (row: TData) => void;
}

export function DoctorsDataTable<TData, TValue>(
    { columns, data, onRowClick }: AppointmentDataType<TData, TValue>
) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [globalFilter, setGlobalFilter] = React.useState("");

    // Derive specialization options from actual therapist data
    const specializationOptions = React.useMemo(() => {
        const specSet = new Set<string>();
        for (const row of data) {
            const specs = (row as Record<string, unknown>).specialization;
            if (Array.isArray(specs)) {
                for (const s of specs) specSet.add(String(s));
            }
        }
        return Array.from(specSet).sort().map((s) => ({ value: s, label: s }));
    }, [data]);

    // Drag a header edge to resize; remembered per table in this browser.

    const cols = useColumnWidths("therapists");

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
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: (row, _columnId, value) => {
            const q = String(value).toLowerCase();
            if (!q) return true;
            const r = row.original as Record<string, unknown>;
            const name = String(r.name ?? "").toLowerCase();
            const specs = Array.isArray(r.specialization) ? r.specialization : [];
            const specMatch = specs.some((s) => String(s).toLowerCase().includes(q));
            return name.includes(q) || specMatch;
        },
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter,
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
                            placeholder="Search by name or specialization..."
                            value={globalFilter}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="max-w-sm mb-2 md:mb-0"
                        />
                        {table.getColumn("specialization") && (
                            <DataTableFacetedFilter
                                column={table.getColumn("specialization")}
                                title="specialization"
                                options={specializationOptions}
                            />
                        )}
                        {(isFiltered || globalFilter) && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    table.resetColumnFilters();
                                    setGlobalFilter("");
                                }}
                                className="h-8 px-2 lg:px-3 flex justify-center items-center gap-2"
                            >
                                Reset
                                <X width={16} />
                            </Button>
                        )}
                        <DataTableViewOptions table={table} />
                    </div>
                    <div className="rounded-md border p-3 overflow-x-auto">
                        <Table className="min-w-[700px]">
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            return (
                                                <ResizableHead key={header.id} header={header} cols={cols} />
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
                                            className={onRowClick ? "cursor-pointer" : undefined}
                                            onClick={
                                                onRowClick
                                                    ? () => onRowClick(row.original)
                                                    : undefined
                                            }
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <ResizableCell key={cell.id} cell={cell} cols={cols} />
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
        </>
    )
}

