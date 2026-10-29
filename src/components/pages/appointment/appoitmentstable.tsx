"use client";

import { formatINR } from "@/components/pages/services/services-columns";
import { childVisitsOf, courseProgressOf, nextVisitOf, visitStartMs, visitWhen } from "@/lib/visit-groups";
import { PackageProgressBadge } from "./package-progress-badge";
import { slotBookingZodType, type ServiceType } from "@/type/schema";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/tables/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { getConfirmedAddonNames } from "@/lib/package-progress";
import { bookingKindOf, bookingLabel } from "@/components/pages/enquiries/booking";
import { AppointmentStatusBadge, shownStatus } from "@/components/status-badge";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { referralColumn } from "@/components/referral-column";
import { format } from "date-fns";

/**
 * Creation time for a booking, in ms. Prefers the Mongoose `createdAt`
 * timestamp; falls back to the timestamp embedded in the Mongo ObjectId
 * (its first 4 bytes are the creation time in seconds) so sorting still
 * works for any legacy row that has no `createdAt`.
 */
function getCreatedMs(row: slotBookingZodType): number {
  const createdAt = (row as unknown as { createdAt?: string }).createdAt;
  if (createdAt) {
    const t = new Date(createdAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const id = row._id ?? "";
  if (id.length >= 8) {
    const seconds = parseInt(id.slice(0, 8), 16);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return 0;
}

// `allAppointments` is every visit, including ones shown inside their booking
// (the Next visit and Sessions columns read it); `services` resolves catalogue
// packages for the Sessions column; `showReferral` adds the Super Admin only
// Referral column.
export function makeAppointmentColumns(
  allAppointments: slotBookingZodType[],
  services: ServiceType[],
  showReferral = false,
): ColumnDef<slotBookingZodType>[] {
  return [
    {
      id: "createdAt",
      accessorFn: (row) => getCreatedMs(row),
      sortingFn: "basic",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Booked on" />
      ),
      cell: ({ row }) => {
        const ms = getCreatedMs(row.original);
        if (!ms) return <span className="text-muted-foreground/40">-</span>;
        return (
          <span className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
            {format(new Date(ms), "yyyy-MM-dd HH:mm")}
          </span>
        );
      },
    },
    {
      id: "bookingId",
      accessorFn: (row) => row.enquiryId ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Booking ID" />
      ),
      cell: ({ row }) => <BookingIdBadge record={row.original} />,
    },
    ...(showReferral ? [referralColumn] : []),
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      // Add-on count lives in its own "Add-ons" column - no badge here.
      cell: ({ row }) => row.getValue("name"),
    },
    {
      // Where the booking's next visit stands (OTP Pending -> Visit Pending ->
      // Session Live -> Completed), worked out by the server from all of its
      // visits so every viewer sees the same; the stored status until a
      // therapist is set.
      id: "status",
      accessorFn: (row) => shownStatus(row) ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <AppointmentStatusBadge status={row.getValue("status") as string} />
      ),
    },
    {
      id: "therapist",
      accessorFn: (row) => row.doctor ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Therapist" />
      ),
      cell: ({ row }) => {
        const name = row.original.doctor;
        return name ? (
          <span className="text-xs">{name}</span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        );
      },
    },
    {
      // The booking's next visit still to happen - itself or one of its later
      // visits (add-on sessions, course follow-ups), which live inside it.
      id: "nextVisit",
      // Sorts soonest first; bookings with nothing coming up go last.
      accessorFn: (row) => {
        const next = nextVisitOf(row, allAppointments);
        return next ? visitStartMs(next) : Infinity;
      },
      sortingFn: "basic",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Next visit" />
      ),
      cell: ({ row }) => {
        const next = nextVisitOf(row.original, allAppointments);
        const more = childVisitsOf(row.original, allAppointments).filter(
          (v) => v.status !== "completed" && v.status !== "cancelled",
        ).length;
        return (
          <div className="flex flex-col gap-0.5 whitespace-nowrap">
            {next ? (
              <span className="text-xs">{visitWhen(next)}</span>
            ) : (
              <span className="text-muted-foreground/40">-</span>
            )}
            {more > 0 && (
              <Badge variant="outline" className="w-fit text-[10px]">
                +{more} visit{more === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "advancePayment",
      accessorFn: (row) =>
        row.paymentReceived ? "Paid" : (row.paymentAmount ?? 0) > 0 ? "Part paid" : "Pending",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Advance payment" />
      ),
      cell: ({ row }) =>
        row.original.paymentReceived ? (
          <Badge
            variant="outline"
            className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
          >
            Paid
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400"
            title={
              (row.original.paymentAmount ?? 0) > 0
                ? `${formatINR(row.original.paymentAmount ?? 0)} of ${formatINR(row.original.quotedPrice ?? 0)} paid`
                : undefined
            }
          >
            {(row.original.paymentAmount ?? 0) > 0 ? "Part paid" : "Pending"}
          </Badge>
        ),
    },
    {
      id: "addOns",
      header: "Add-ons",
      cell: ({ row }) => {
        const stacked = row.original.recommendedServices ?? [];
        if (stacked.length === 0) {
          return <span className="text-muted-foreground/40">-</span>;
        }
        const pending = stacked.filter((r) => r.status === "pending").length;
        const confirmed = getConfirmedAddonNames(row.original);
        return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <Badge variant="secondary" className="text-[10px] w-fit">
              {stacked.length} on this visit
              {pending > 0 ? ` · ${pending} pending` : ""}
            </Badge>
            {confirmed.length > 0 && (
              <span className="text-[10px] text-muted-foreground truncate" title={confirmed.join(", ")}>
                {confirmed.join(", ")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      // Course progress ("1 of 9 completed"), restored from before the July
      // cleanup. Single visits have no sessions to count, so they show "-".
      id: "session",
      header: "Sessions",
      cell: ({ row }) => {
        const progress = courseProgressOf(row.original, allAppointments, services);
        return progress ? (
          <PackageProgressBadge progress={progress} />
        ) : (
          <span className="text-muted-foreground/40">-</span>
        );
      },
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => row.getValue("location"),
    },
    {
      accessorKey: "age",
      header: "Age",
      cell: ({ row }) => row.getValue("age"),
    },
    {
      accessorKey: "phonenumber",
      header: "Phone Number",
      cell: ({ row }) => row.getValue("phonenumber"),
    },
    {
      id: "service",
      header: "Service",
      cell: ({ row }) => {
        // New bookings store the service in `service`; old rows kept it in the
        // now-deprecated `category`. A pure session booking has neither - show
        // its session count instead.
        const s = row.original.service || row.original.category;
        if (s) return s;
        const n = row.original.sessionNumber;
        return n ? `Session ×${n}` : "--";
      },
    },
    {
      accessorKey: "time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Time" />
      ),
      cell: ({ row }) => row.original.slot?.time ?? "--",
    },
    {
      id: "typeOfappointment",
      // Raw enum values used to leak here ("appointment" for what is really a
      // home visit). bookingLabel routes a course away from the intake labels.
      accessorFn: (r) => bookingLabel(r),
      header: "Type",
      cell: ({ row }) => {
        const isCourse = bookingKindOf(row.original) === "course";
        return (
          <Badge variant={isCourse ? "default" : "secondary"}>
            {bookingLabel(row.original)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => {
        const dateString: string | undefined = row.original.slot?.date;
        if (!dateString) return "--";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "--";
        return date.toISOString().split("T")[0];
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: "note",
      header: "Note",
      cell: ({ row }) => row.getValue("note"),
    },
  ];
}

/** @deprecated Prefer makeAppointmentColumns(allAppointments, services). */
export const AppointmentBookingColumn: ColumnDef<slotBookingZodType>[] =
  makeAppointmentColumns([], []);
