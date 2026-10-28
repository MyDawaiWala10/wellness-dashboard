"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  CalendarDays,
  UserRound,
} from "lucide-react";
import { genderLabel } from "@/lib/person";
import { format, formatDistanceToNow } from "date-fns";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { EnquiryIntakeModal } from "@/components/pages/enquiries/enquiry-intake-modal";
import type { Customer } from "@/data/customer/customer";
import type { ActivityEntry, EnquiryType } from "@/type/schema";
import type { CustomerNote } from "@/type/customer-record";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { tidyActivityText } from "@/lib/utils";
import { addCustomerNote, editCustomerNote } from "@/actions/customers/update-customer-notes";
import { toast } from "sonner";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { NotesTimeline } from "@/components/notes-timeline";
import { buildNotesTimeline } from "@/lib/notes-timeline";

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  onClose: () => void;
}

const SEGMENT_LABEL: Record<string, string> = {
  new: "New customer",
  returning: "Returning customer",
  vip: "VIP",
};

const SEGMENT_CLASS: Record<string, string> = {
  new: "border-blue-600 text-blue-700 bg-blue-50",
  returning: "border-emerald-600 text-emerald-700 bg-emerald-50",
  vip: "border-amber-600 text-amber-800 bg-amber-100",
};


/**
 * Build a chronological activity timeline from ALL of a customer's bookings.
 * Merges backend-stored activityLog entries with milestone entries derived
 * from timestamp fields, sorted oldest-first.
 */
function buildCustomerActivity(bookings: EnquiryType[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const b of bookings) {
    const handler = b.reachedOutBy?.name;
    const handlerId = b.reachedOutBy?.userId;
    const enquiryId = b.enquiryId ?? "";

    // Derived milestones from timestamp fields
    if (handler) {
      if (b.executiveReachedOutAt) {
        entries.push({
          at: b.executiveReachedOutAt,
          userId: handlerId,
          name: handler,
          action: `${enquiryId}: Reached out to lead`,
        });
      }
      if (b.consultationCompletedAt) {
        entries.push({
          at: b.consultationCompletedAt,
          userId: handlerId,
          name: handler,
          action: `${enquiryId}: Consultation completed`,
        });
      }
      if (b.physioAssignmentConfirmedAt) {
        entries.push({
          at: b.physioAssignmentConfirmedAt,
          userId: handlerId,
          name: handler,
          action: `${enquiryId}: Therapist assigned`,
        });
      }
    }
    if (b.paymentReceivedAt) {
      entries.push({
        at: b.paymentReceivedAt,
        userId: handlerId,
        name: handler ?? "System",
        action: `${enquiryId}: Payment received`,
      });
    }
    if (b.completedAt) {
      entries.push({
        at: b.completedAt,
        userId: handlerId,
        name: handler ?? "System",
        action: `${enquiryId}: Session completed`,
      });
    }

    // Backend-stored activity log
    if (b.activityLog?.length) {
      for (const e of b.activityLog) {
        entries.push({
          ...e,
          action: `${enquiryId}: ${e.action}`,
        });
      }
    }
  }

  return entries
    .filter((e) => e.name && e.name !== "System")
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function BookingRow({ booking, index }: { booking: EnquiryType; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = booking.status ?? "enquiry";
  const createdAt = (booking as unknown as { createdAt?: string }).createdAt;


  return (
    <div className="border rounded-md overflow-hidden">
      {/* Summary row - always visible, click to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {booking.enquiryId ? (
              <BookingIdBadge record={booking} />
            ) : (
              <span className="font-mono text-xs text-muted-foreground">
                #{index + 1}
              </span>
            )}
            <AppointmentStatusBadge status={status} />
            {booking.service && (
              <span className="text-xs text-muted-foreground">
                {booking.service}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {createdAt
              ? `Booked ${formatDistanceToNow(new Date(createdAt), { addSuffix: true })}`
              : "-"}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t p-3 space-y-2 text-sm bg-muted/30">
          <DetailRow label="Service" value={booking.service ?? booking.typeOfappointment ?? "-"} />
          <DetailRow
            label="Consultation slot"
            value={
              booking.consultationSlot?.date
                ? `${booking.consultationSlot.date} ${booking.consultationSlot.time}`
                : "-"
            }
          />
          <DetailRow
            label="Consultation done"
            value={booking.consultationCompleted ? "Yes" : "-"}
          />
          <DetailRow
            label="Physio slot"
            value={
              booking.physioSlot?.date
                ? `${booking.physioSlot.date} ${booking.physioSlot.time}`
                : "-"
            }
          />
          <DetailRow label="Therapist" value={booking.doctor ?? "-"} />
          <DetailRow
            label="Assignment confirmed"
            value={booking.physioAssignmentConfirmed ? "Yes" : "-"}
          />
          <DetailRow
            label="Handled by"
            value={booking.reachedOutBy?.name ?? "-"}
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function CustomerDetailDrawer({
  customer,
  onClose,
}: CustomerDetailDrawerProps) {
  const open = customer !== null;
  const [localNotes, setLocalNotes] = useState<CustomerNote[]>(customer?.notes ?? []);

  async function addNote(customerId: string, text: string): Promise<boolean> {
    const result = await addCustomerNote(customerId, { note: text });
    if (!result.success || !result.data) {
      toast.error(result.message);
      return false;
    }
    setLocalNotes(result.data.notes ?? []);
    toast.success("Note added");
    return true;
  }

  async function editNote(customerId: string, original: CustomerNote, text: string): Promise<boolean> {
    const result = await editCustomerNote(customerId, { at: original.at, by: original.by, note: text });
    if (!result.success || !result.data) {
      toast.error(result.message);
      return false;
    }
    setLocalNotes(result.data.notes ?? []);
    toast.success("Note updated");
    return true;
  }

  // Re-sync notes whenever the parent refreshes the customer object (e.g. after
  // a session completion mirrors the note into the customer record and the
  // customers query refetches).
  useEffect(() => {
    setLocalNotes(customer?.notes ?? []);
  }, [customer?.notes]);

  const fullHistory = useMemo(
    () => (customer ? buildCustomerActivity(customer.bookings) : []),
    [customer],
  );

  if (!customer) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const firstSeen = customer.firstBookingAt
    ? format(new Date(customer.firstBookingAt), "PP")
    : "-";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {customer.name}
            <Badge
              variant="outline"
              className={SEGMENT_CLASS[customer.segment]}
            >
              {SEGMENT_LABEL[customer.segment]}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            {customer.customer_id ? (
              <>
                Customer ID{" "}
                <span className="font-mono font-medium text-foreground">
                  {customer.customer_id}
                </span>
              </>
            ) : (
              "Full booking history for this customer."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {/* Contact card */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{customer.phonenumber}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{customer.location}</span>
              </div>
            )}
            {(customer.gender || customer.age) && (
              <div className="flex items-center gap-2 text-sm">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[genderLabel(customer.gender), customer.age && `${customer.age} years`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>Customer since {firstSeen}</span>
            </div>
          </section>

          <Separator />

          {/* Mini stats */}
          <section className="grid grid-cols-3 gap-2 text-center">
            <div className="border rounded-md p-3">
              <div className="text-2xl font-bold tabular-nums">
                {customer.totalBookings}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Active bookings
              </div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-2xl font-bold tabular-nums">
                {customer.bookings.filter((b) => b.status === "completed").length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Completed</div>
            </div>
            <div className="border rounded-md p-3">
              <div className="text-2xl font-bold tabular-nums">
                {customer.bookings.filter((b) => b.status === "cancelled").length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Cancelled</div>
            </div>
          </section>

          <Separator />

          {/* Bookings list */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              Bookings ({customer.bookings.length})
            </h3>
            {customer.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <div className="space-y-2">
                {customer.bookings.map((b, i) => (
                  <BookingRow key={b._id ?? i} booking={b} index={i} />
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Every note about this customer, tagged Customer / Therapist / Office. */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Notes</h3>
            <NotesTimeline
              timeline={buildNotesTimeline(customer.bookings, localNotes)}
              onAdd={customer.customer_id ? (text) => addNote(customer.customer_id!, text) : undefined}
              onEdit={customer.customer_id ? (note, text) => editNote(customer.customer_id!, note, text) : undefined}
            />
          </section>

          <Separator />

          {/* Full activity timeline */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              Full History ({fullHistory.length})
            </h3>
            {fullHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            ) : (
              <ol className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {fullHistory.map((e, i) => (
                  <li
                    key={`${e.at}-${i}`}
                    className="text-xs border-l-2 border-muted pl-3 pb-0.5"
                  >
                    <div className="text-foreground">
                      {tidyActivityText(e.action)}
                    </div>
                    <div className="text-muted-foreground">
                      {e.name}
                      {" · "}
                      {new Date(e.at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Footer */}
          <Separator />
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
            <EnquiryIntakeModal
              prefill={{
                name: customer.name,
                phonenumber: customer.phonenumber,
                note: `[Returning customer] Follow-up booking`,
              }}
              triggerLabel="Book new session"
              triggerVariant="default"
              className="w-full sm:w-auto"
            />
            <SheetClose asChild>
              <Button variant="outline" className="w-full sm:w-auto sm:ml-auto">
                Close
              </Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
