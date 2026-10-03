"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  CalendarDays,
  Pencil,
  Plus,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

import { EnquiryIntakeModal } from "@/components/pages/enquiries/enquiry-intake-modal";
import type { Customer } from "@/data/customer/customer";
import type { ActivityEntry, EnquiryType } from "@/type/schema";
import type { CustomerNote } from "@/type/customer-record";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { tidyActivityText } from "@/lib/utils";
import { useAuthStore } from "@/providers/permission-provider";
import { addCustomerNote, editCustomerNote } from "@/actions/customers/update-customer-notes";
import { toast } from "sonner";
import { BookingIdBadge } from "@/components/booking-id-badge";

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

function formatTimeRange(r: { from?: string; to?: string } | undefined) {
  if (!r?.from || !r?.to) return null;
  const toAmPm = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h)) return hhmm;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${toAmPm(r.from)} - ${toAmPm(r.to)}`;
}

function TherapistNotes({
  customerId,
  notes,
  onNotesUpdate,
}: {
  customerId: string;
  notes: CustomerNote[];
  onNotesUpdate: (notes: CustomerNote[]) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const isTherapist = user?.role === "THERAPIST";
  const [isAdding, setIsAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [newNote, setNewNote] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [notes],
  );

  const handleAdd = async () => {
    if (!newNote.trim() || !user) return;
    setSaving(true);
    const note: CustomerNote = {
      at: new Date().toISOString(),
      by: `${user.userfName} ${user.userlName}`.trim(),
      userId: user.id,
      note: newNote.trim(),
    };
    const result = await addCustomerNote(customerId, note);
    setSaving(false);
    if (result.success && result.data) {
      onNotesUpdate(result.data.notes ?? []);
      setNewNote("");
      setIsAdding(false);
      toast.success("Note added");
    } else {
      toast.error(result.message);
    }
  };

  const handleEdit = async (original: CustomerNote) => {
    if (!editNote.trim()) return;
    setSaving(true);
    const result = await editCustomerNote(customerId, {
      at: original.at,
      by: original.by,
      note: editNote.trim(),
    });
    setSaving(false);
    if (result.success && result.data) {
      onNotesUpdate(result.data.notes ?? []);
      setEditNote("");
      setEditingIdx(null);
      toast.success("Note updated");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Therapist Notes ({notes.length})</h3>
        {isTherapist && !isAdding && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add note
          </Button>
        )}
      </div>

      {/* Add note form */}
      {isAdding && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <Textarea
            placeholder="Type your note about this customer..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setIsAdding(false);
                setNewNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={saving || !newNote.trim()}
            >
              {saving ? "Saving..." : "Save note"}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {sortedNotes.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground">No therapist notes yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedNotes.map((n, i) => (
            <div key={`${n.at}-${n.by}-${i}`} className="border rounded-md p-3 text-sm">
              {editingIdx === i ? (
                <div className="space-y-2">
                  <Textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditingIdx(null);
                        setEditNote("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleEdit(n)}
                      disabled={saving || !editNote.trim()}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{n.note}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {n.by} · {format(new Date(n.at), "dd MMM yyyy, h:mm a")}
                    </span>
                    {isTherapist && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setEditingIdx(i);
                          setEditNote(n.note);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
  const sessionNotes = booking.sessionNotes ?? [];

  const serviceFromNote = (() => {
    const note = booking.note ?? "";
    const m = note.match(/^\[Service:\s*([^\]]+)\]/);
    return m ? m[1].trim() : null;
  })();

  const preferred = formatTimeRange(booking.preferredReachOutTime);

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
            {serviceFromNote && (
              <span className="text-xs text-muted-foreground">
                {serviceFromNote}
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
          <DetailRow label="Service" value={serviceFromNote ?? booking.typeOfappointment ?? "-"} />
          <DetailRow label="Preferred time" value={preferred ?? "-"} />
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
          {booking.note && (
            <div className="pt-1">
              <div className="text-xs text-muted-foreground">Notes</div>
              <p className="text-sm whitespace-pre-wrap mt-1">{booking.note}</p>
            </div>
          )}

          {/* Session notes */}
          {sessionNotes.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                Completed Sessions ({sessionNotes.length})
              </div>
              <div className="space-y-0">
                {sessionNotes.map((s, i) => (
                  <details key={i} className="group border-b last:border-0">
                    <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 text-[13px]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="font-medium">Session {s.session}</span>
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                        {s.at ? format(new Date(s.at), "dd MMM") : ""}
                        {s.therapist ? ` · ${s.therapist}` : ""}
                      </span>
                    </summary>
                    {s.note ? (
                      <p className="mb-2 ml-5 whitespace-pre-wrap rounded-r border-l-2 border-emerald-500 bg-muted/50 px-2.5 py-2 text-xs leading-relaxed">
                        {s.note}
                      </p>
                    ) : (
                      <p className="mb-2 ml-5 text-xs italic text-muted-foreground">
                        No note recorded.
                      </p>
                    )}
                  </details>
                ))}
              </div>
            </div>
          )}
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

          {/* Therapist Notes */}
          {customer.customer_id && (
            <TherapistNotes
              customerId={customer.customer_id}
              notes={localNotes}
              onNotesUpdate={setLocalNotes}
            />
          )}

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
