"use client";

import { useState } from "react";

import { BookingSourceField } from "@/components/booking-source-field";
import { useUpdateAppointment } from "@/data/appointment/appointment";
import {
  bookingSource,
  bookingSourceError,
  type BookingSource,
  type BookingSourceValue,
} from "@/lib/booking-source";
import { useAuthStore } from "@/providers/permission-provider";
import type { EnquiryType } from "@/type/schema";

export type BookingSourcePatch = {
  source: BookingSource;
  referredByDoctorId: string | null;
};

/**
 * Correct how a booking reached us, from either drawer. Saves on change, but
 * only once the pick is complete, so "Via Therapist" waits for the therapist.
 * The half-made pick stays in local state and never leaks into a drawer draft.
 *
 * `onSave` lets a drawer route the save through its own pipeline. The enquiry
 * drawer needs that: it autosaves its whole local draft, so the source has to
 * land in that draft too, or its next autosave echoes the old value back. It
 * also keeps the drawer's "not your lead, give a reason" lock in force.
 *
 * Mount with `key={record._id}` so the pick resets when another booking opens.
 */
export function BookingSourceEditor({
  record,
  onSave,
  saving,
}: {
  record: EnquiryType;
  onSave?: (patch: BookingSourcePatch) => void;
  saving?: boolean;
}) {
  const { mutate: update, isPending } = useUpdateAppointment({ silent: true });
  // Therapists see the source but don't set it: who referred a booking is the
  // back office's call, and a therapist could otherwise credit themselves.
  // UI-level only, like the rest of the therapist scoping on these screens.
  const isTherapist = useAuthStore((s) => s.user?.role) === "THERAPIST";

  const [draft, setDraft] = useState<BookingSourceValue>({
    source: bookingSource(record),
    referredByDoctorId: record.referredByDoctorId ?? null,
  });

  function handleChange(next: BookingSourceValue) {
    setDraft(next);
    if (bookingSourceError(next) || !next.source) return;
    const patch: BookingSourcePatch = {
      source: next.source,
      referredByDoctorId: next.referredByDoctorId ?? null,
    };
    if (onSave) onSave(patch);
    else update({ ...record, ...patch });
  }

  return (
    <section className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        How they reached us
      </p>
      <BookingSourceField
        value={draft}
        onChange={handleChange}
        error={draft.source === "therapist" ? bookingSourceError(draft) : undefined}
        disabled={isTherapist || (saving ?? isPending)}
      />
    </section>
  );
}
