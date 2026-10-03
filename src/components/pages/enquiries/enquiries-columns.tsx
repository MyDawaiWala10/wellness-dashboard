"use client";

import { useState } from "react";
import { ColumnDef, Column } from "@tanstack/react-table";
import { MoreHorizontal, Check, Info } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataTableColumnHeader } from "@/components/tables/data-table-column-header";
import { formatINR } from "@/components/pages/services/services-columns";
import type { EnquiryType } from "@/type/schema";
import { EnquiryStatusBadge } from "./enquiry-status-badge";
import { formatTimeRange } from "./time-range";
import { bookingTypeLabel, toDayKey } from "./booking";
import { BookingIdBadge } from "@/components/booking-id-badge";

/**
 * Read the Mongoose-side updatedAt timestamp (created/updatedAt aren't in the
 * Zod schema but are present at runtime). Falls back to createdAt, then null.
 */
function readLastActiveISO(r: EnquiryType): string | undefined {
  const m = r as unknown as { updatedAt?: string; createdAt?: string };
  return m.updatedAt ?? m.createdAt;
}

function readCreatedISO(r: EnquiryType): string | undefined {
  return (r as unknown as { createdAt?: string }).createdAt;
}

/**
 * Header label with an info hint that opens INSTANTLY on hover (no native-title
 * delay) and also toggles on click/tap - so it works on touch too.
 */
function HeaderHint({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {label}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`What does "${label}" mean?`}
            className="inline-flex text-muted-foreground hover:text-foreground transition-colors cursor-help"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-56 text-xs leading-relaxed p-2.5"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {hint}
        </PopoverContent>
      </Popover>
    </span>
  );
}

function LastActiveCell({
  record,
  field,
}: {
  record: EnquiryType;
  field: "received" | "updated";
}) {
  const iso =
    field === "received" ? readCreatedISO(record) : readLastActiveISO(record);
  if (!iso) return <span className="text-muted-foreground">-</span>;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="whitespace-nowrap" title={date.toLocaleString()}>
      {format(date, "yyyy-MM-dd HH:mm")}
    </span>
  );
}

function CheckOrDash({
  checked,
  disabled = false,
}: {
  checked: boolean | undefined;
  disabled?: boolean;
}) {
  if (checked) {
    return <Check className="inline h-4 w-4 text-green-600" />;
  }
  return (
    <span className={disabled ? "text-muted-foreground/40" : "text-muted-foreground"}>
      -
    </span>
  );
}

function SlotCell({
  slot,
}: {
  slot: { date: string; time: string } | undefined;
}) {
  // `slot.date` is a Date backend-side, so it arrives as a full ISO string.
  const day = toDayKey(slot?.date);
  if (!day || !slot?.time) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="leading-tight whitespace-nowrap">
      {day} {slot.time}
    </div>
  );
}

interface MakeColumnsParams {
  onOpenDetail: (record: EnquiryType) => void;
  /** Header label for the timestamp column - differs per section
   *  ("Waiting since" for untouched, "Last updated" for attended). */
  lastActiveLabel?: string;
  /** Which timestamp to show: "received" = createdAt (when the enquiry came
   *  in), "updated" = updatedAt (last staff action). */
  lastActiveField?: "received" | "updated";
  /** Show a "Call tries" column (failed reach-out attempts) - used on Follow-ups. */
  showAttempts?: boolean;
  /** Show contact/intake columns (email, city, type) - used on Follow-ups. */
  showContactCols?: boolean;
}

export function makeEnquiryColumns({
  onOpenDetail,
  lastActiveLabel = "Last active",
  lastActiveField = "updated",
  showAttempts = false,
  showContactCols = false,
}: MakeColumnsParams): ColumnDef<EnquiryType>[] {
  return [
    {
      id: "enquiryId",
      accessorFn: (r) => r.enquiryId ?? "",
      header: "ID",
      cell: ({ row }) => <BookingIdBadge record={row.original} />,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const count = row.original.repeatCount ?? 1;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium">{row.original.name || "-"}</span>
            {count > 1 && (
              <span
                title={`This person submitted ${count} bookings while this lead was open - see the activity log`}
                className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 whitespace-nowrap dark:bg-amber-950/40 dark:text-amber-400"
              >
                ↺ {count}
              </span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: "phonenumber",
      header: "Phone",
      cell: ({ row }) => row.original.phonenumber ?? "-",
    },
    // ── Contact / intake details (only rendered on the Follow-ups view) ──
    ...(showContactCols
      ? [
          {
            accessorKey: "email",
            header: "Email",
            cell: ({ row }: { row: { original: EnquiryType } }) =>
              row.original.email ? (
                <span className="text-sm whitespace-nowrap">
                  {row.original.email}
                </span>
              ) : (
                <span className="text-muted-foreground/40">-</span>
              ),
          } as ColumnDef<EnquiryType>,
          {
            accessorKey: "location",
            header: "City",
            cell: ({ row }: { row: { original: EnquiryType } }) =>
              row.original.location ? (
                <span className="text-sm whitespace-nowrap">
                  {row.original.location}
                </span>
              ) : (
                <span className="text-muted-foreground/40">-</span>
              ),
          } as ColumnDef<EnquiryType>,
        ]
      : []),
    // ── Headline: where the lead is in the journey ──
    {
      id: "status",
      header: () => (
        <HeaderHint
          label="Stage"
          hint="Where this lead is in the journey: Reached out → Consult booked → Consult done → Physio booked → Assigned"
        />
      ),
      cell: ({ row }) => <EnquiryStatusBadge record={row.original} />,
    },
    {
      id: "preferredReachOutTime",
      // Sort by window start ("HH:MM" sorts correctly as a 24h string); the cell
      // still renders the full range from row.original.
      accessorFn: (r) => r.preferredReachOutTime?.from ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Preferred call time" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatTimeRange(row.original.preferredReachOutTime)}
        </span>
      ),
    },
    // ── Call tries (only rendered on the Follow-ups view) ──
    ...(showAttempts
      ? [
          {
            id: "attempts",
            accessorFn: (r: EnquiryType) => r.reachAttempts ?? 0,
            header: ({ column }: { column: Column<EnquiryType, unknown> }) => (
              <DataTableColumnHeader column={column} title="Call tries" />
            ),
            cell: ({ row }: { row: { original: EnquiryType } }) => {
              const n = row.original.reachAttempts ?? 0;
              const iso = row.original.lastAttemptAt;
              const last = iso ? new Date(iso) : null;
              return (
                <div className="whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                    {n} {n === 1 ? "try" : "tries"}
                  </span>
                  {last && !Number.isNaN(last.getTime()) && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      last {format(last, "yyyy-MM-dd HH:mm")}
                    </span>
                  )}
                </div>
              );
            },
          } as ColumnDef<EnquiryType>,
        ]
      : []),
    // ── Type of appointment (only rendered on the Follow-ups view) ──
    ...(showContactCols
      ? [
          {
            id: "typeOfappointment",
            accessorFn: (r: EnquiryType) =>
              bookingTypeLabel(r.typeOfappointment) ?? "",
            header: "Type",
            cell: ({ row }: { row: { original: EnquiryType } }) => {
              const label = bookingTypeLabel(row.original.typeOfappointment);
              return label ? (
                <span className="text-sm whitespace-nowrap">{label}</span>
              ) : (
                <span className="text-muted-foreground/40">-</span>
              );
            },
          } as ColumnDef<EnquiryType>,
        ]
      : []),
    // ── Stage ① Reach-out ──
    {
      id: "reach",
      header: () => (
        <HeaderHint
          label="Reached"
          hint="Step 2 - an executive has phoned/contacted the lead"
        />
      ),
      cell: ({ row }) => (
        <CheckOrDash checked={row.original.executiveReachedOut} />
      ),
    },
    // ── Stage ③ Confirm booking ──
    {
      id: "bookingType",
      accessorFn: (r) => bookingTypeLabel(r.typeOfappointment) ?? "",
      header: () => (
        <HeaderHint
          label="Booking"
          hint="Step 3 - the booking the executive confirmed: online consultation or home visit"
        />
      ),
      cell: ({ row }) => {
        const label = bookingTypeLabel(row.original.typeOfappointment);
        return label ? (
          <span className="text-sm whitespace-nowrap">{label}</span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        );
      },
    },
    {
      id: "fee",
      accessorFn: (r) => r.quotedPrice ?? 0,
      header: () => (
        <HeaderHint
          label="Fee"
          hint="Step 3 - the agreed fee, pre-filled from the Services catalogue"
        />
      ),
      cell: ({ row }) =>
        row.original.quotedPrice ? (
          <span className="text-sm tabular-nums whitespace-nowrap">
            {formatINR(row.original.quotedPrice)}
          </span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        ),
    },
    // ── Stage ④ Payment ──
    {
      id: "paid",
      header: () => (
        <HeaderHint
          label="Paid"
          hint="Step 4 - payment has cleared; this unlocks the therapist assignment"
        />
      ),
      cell: ({ row }) => <CheckOrDash checked={row.original.paymentReceived} />,
    },
    // ── Stage ⑤ Assign therapist ──
    {
      id: "physioTherapist",
      accessorFn: (r) => r.doctor ?? "",
      header: () => (
        <HeaderHint
          label="Therapist"
          hint="Step 5 - the therapist assigned to the visit"
        />
      ),
      cell: ({ row }) =>
        row.original.doctor ? (
          <span className="text-sm whitespace-nowrap">{row.original.doctor}</span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        ),
    },
    {
      id: "visitSlot",
      header: () => (
        <HeaderHint
          label="Visit"
          hint="Step 5 - the confirmed date and time; the booking now shows on Appointments"
        />
      ),
      cell: ({ row }) => <SlotCell slot={row.original.slot} />,
    },
    // ── Tracking ──
    {
      id: "reachedOutBy",
      accessorFn: (r) => r.reachedOutBy?.name ?? "",
      header: () => (
        <HeaderHint
          label="Handled by"
          hint="The executive who first took ownership of this lead"
        />
      ),
      cell: ({ row }) => {
        const name = row.original.reachedOutBy?.name;
        return name ? (
          <span className="whitespace-nowrap text-sm">{name}</span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        );
      },
    },
    {
      id: "lastActive",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={lastActiveLabel} />
      ),
      accessorFn: (r) =>
        (lastActiveField === "received"
          ? readCreatedISO(r)
          : readLastActiveISO(r)) ?? "",
      cell: ({ row }) => (
        <LastActiveCell record={row.original} field={lastActiveField} />
      ),
    },
    {
      id: "action",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(row.original);
          }}
        >
          <span className="sr-only">Open detail</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      ),
    },
  ];
}
