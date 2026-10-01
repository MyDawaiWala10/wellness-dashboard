"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import {
  BOOKING_SOURCES,
  type BookingSource,
  type BookingSourceValue,
} from "@/lib/booking-source";

/**
 * "How did they reach us?" - the one picker for a booking's source, used by
 * New Enquiry, Book Slot and both booking drawers.
 *
 * There's deliberately no default: an untouched field would otherwise save a
 * walk-in as WhatsApp. Via Therapist also asks which therapist referred them.
 */
export function BookingSourceField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: BookingSourceValue;
  onChange: (next: BookingSourceValue) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { data: therapists = [] } = useGetAllTherapist();
  const active = (therapists as { doctorId: string; name: string; isActive?: boolean }[])
    // Keep a since-deactivated referrer selectable on an existing booking.
    .filter((t) => t.isActive !== false || t.doctorId === value.referredByDoctorId);

  return (
    <div className="space-y-1.5">
      <div className="grid gap-1.5 sm:grid-cols-2">
        <Select
          value={value.source || undefined}
          disabled={disabled}
          onValueChange={(source) =>
            onChange({
              source: source as BookingSource,
              // Only a therapist referral carries a referrer.
              referredByDoctorId:
                source === "therapist" ? value.referredByDoctorId ?? null : null,
            })
          }
        >
          <SelectTrigger aria-label="How did they reach us?" className="h-9 w-full">
            <SelectValue placeholder="How did they reach us?" />
          </SelectTrigger>
          <SelectContent>
            {BOOKING_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${s.className}`}
                  />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value.source === "therapist" && (
          <Select
            value={value.referredByDoctorId || undefined}
            disabled={disabled}
            onValueChange={(referredByDoctorId) =>
              onChange({ ...value, referredByDoctorId })
            }
          >
            <SelectTrigger aria-label="Referring therapist" className="h-9 w-full">
              <SelectValue placeholder="Which therapist?" />
            </SelectTrigger>
            <SelectContent>
              {active.map((t) => (
                <SelectItem key={t.doctorId} value={t.doctorId}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
