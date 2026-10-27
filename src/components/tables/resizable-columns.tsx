"use client";

import * as React from "react";
import { flexRender, type Cell, type Header } from "@tanstack/react-table";

import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Drag-to-resize table columns. A column keeps its natural width until someone
// drags its header edge; from then on it's that wide (content past it is cut
// with "…"), remembered in this browser per table. Double-click the edge to
// give the column back its natural width.

type Widths = Record<string, number>;
export type ColumnWidths = { widths: Widths; setWidth: (id: string, px?: number) => void };

const MIN_WIDTH = 48;
const KEY_STEP = 16;

function load(key: string): Widths {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

/** Column widths for one table, kept in localStorage under `tableKey`. */
export function useColumnWidths(tableKey: string): ColumnWidths {
  const key = `mdw:col-widths:${tableKey}`;
  const [widths, setWidths] = React.useState<Widths>({});
  // Read after mount: the server render has no localStorage.
  React.useEffect(() => setWidths(load(key)), [key]);

  const setWidth = React.useCallback(
    (id: string, px?: number) =>
      setWidths((prev) => {
        const next = { ...prev };
        if (px === undefined) delete next[id];
        else next[id] = Math.max(MIN_WIDTH, Math.round(px));
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage unavailable - the width just won't be remembered */
        }
        return next;
      }),
    [key],
  );

  return { widths, setWidth };
}

/** Pins content to the column's chosen width; untouched columns size naturally. */
function Sized({ width, children }: { width?: number; children: React.ReactNode }) {
  if (width === undefined) return <>{children}</>;
  return (
    <div style={{ width }} className="overflow-hidden text-ellipsis">
      {children}
    </div>
  );
}

/** Content width of the header cell the handle sits in (its width minus padding). */
function contentWidth(th: HTMLElement): number {
  const s = getComputedStyle(th);
  return th.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
}

function ResizeHandle({ id, cols }: { id: string; cols: ColumnWidths }) {
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't let the drag also click the header (that would sort the column).
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const start = contentWidth(handle.parentElement!);
    const startX = e.clientX;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => cols.setWidth(id, start + ev.clientX - startX);
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const current = contentWidth(e.currentTarget.parentElement!);
    cols.setWidth(id, current + (e.key === "ArrowRight" ? KEY_STEP : -KEY_STEP));
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column (drag, or arrow keys; double-click to reset)"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        cols.setWidth(id, undefined);
      }}
      // z-10: the next header's sort button is pulled left (-ml-3) over this edge.
      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none border-r-2 border-transparent hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
    />
  );
}

/** A header cell for column `columnId`, with a drag handle on its right edge. */
export function ColumnHead({
  columnId,
  cols,
  className,
  children,
  ...props
}: { columnId: string; cols: ColumnWidths } & React.ComponentProps<typeof TableHead>) {
  return (
    <TableHead {...props} className={cn("relative", className)}>
      <Sized width={cols.widths[columnId]}>{children}</Sized>
      <ResizeHandle id={columnId} cols={cols} />
    </TableHead>
  );
}

/** A body cell that follows column `columnId`'s chosen width. */
export function ColumnCell({
  columnId,
  cols,
  children,
  ...props
}: { columnId: string; cols: ColumnWidths } & React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell {...props}>
      <Sized width={cols.widths[columnId]}>{children}</Sized>
    </TableCell>
  );
}

// The same two, for tables built with @tanstack/react-table.

export function ResizableHead<T>({ header, cols }: { header: Header<T, unknown>; cols: ColumnWidths }) {
  if (header.isPlaceholder) return <TableHead />;
  return (
    <ColumnHead columnId={header.column.id} cols={cols}>
      {flexRender(header.column.columnDef.header, header.getContext())}
    </ColumnHead>
  );
}

export function ResizableCell<T>({
  cell,
  cols,
  ...props
}: { cell: Cell<T, unknown>; cols: ColumnWidths } & React.ComponentProps<typeof TableCell>) {
  return (
    <ColumnCell columnId={cell.column.id} cols={cols} {...props}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </ColumnCell>
  );
}
