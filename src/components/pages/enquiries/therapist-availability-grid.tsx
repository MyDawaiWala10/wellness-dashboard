"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import { useGetAllAppointments } from "@/data/appointment/appointment";
import { useGetClinicSettings } from "@/data/clinic-settings/clinic-settings";
import { useGetAllTherapistLeaves } from "@/data/therapist/therapist-leaves";
import { useAuthStore } from "@/providers/permission-provider";
import type { TherapistformType } from "@/type/schema";
import {
  checkConflict,
  toMinutes,
  type ConflictResult,
} from "@/lib/booking-conflicts";

/** The bookable times of day. */
export const TIME_SLOTS = [
  "9:30",
  "10:30",
  "11:30",
  "12:30",
  "13:30",
  "14:30",
  "15:30",
  "16:30",
  "17:30",
  "18:30",
  "19:30",
  "20:30",
];

/** Assignable visit lengths, in minutes. */
const DURATION_OPTIONS = [30, 60, 90, 120];

interface TherapistAvailabilityGridProps {
  /** The picked day, "yyyy-MM-dd". */
  date: string;
  /** Currently chosen therapist, so their cell can be shown as selected. */
  selectedDoctorId?: string;
  /** The chosen START time, "HH:MM" - the grid shades the span it covers. */
  selectedStart?: string;
  /** This enquiry's own record - its slot must not count against itself. */
  excludeRecordId?: string;
  /** Show only this therapist's row (their own day), without the search and
   *  duration picker: the caller already has those (the add-on form). */
  doctorId?: string;
  /** Visit length in minutes - controlled by the caller (owns the conflict check). */
  durationMin: number;
  onDurationChange: (d: number) => void;
  onPick: (pick: {
    doctorId: string;
    doctor: string;
    startTime: string;
    durationMin: number;
  }) => void;
}

/**
 * Rows = therapists, columns = time slots, cells free/busy for one day.
 * Clicking a free cell picks the therapist and the time in a single action.
 *
 * Deliberately a grid and not a calendar library: this is an ERP-shaped app
 * where the executive is choosing among therapists at a glance, and horizontal
 * space is the constraint.
 */
export function TherapistAvailabilityGrid({
  date,
  selectedDoctorId,
  selectedStart,
  excludeRecordId,
  doctorId: onlyDoctorId,
  durationMin,
  onDurationChange,
  onPick,
}: TherapistAvailabilityGridProps) {
  const { data: therapists } = useGetAllTherapist();
  const authUser = useAuthStore((s) => s.user);
  const { data: appointments = [] } = useGetAllAppointments({
    id: authUser?.id,
    role: authUser?.role,
    userEmail: authUser?.userEmail,
  });
  const { data: settings } = useGetClinicSettings();
  const { data: allLeaves = [] } = useGetAllTherapistLeaves(date);
  const gap = settings?.bookingGapMinutes ?? 60;
  const [query, setQuery] = useState("");

  const all = useMemo(
    () =>
      ((therapists ?? []) as TherapistformType[]).filter(
        (t) =>
          t.doctorId &&
          t.isActive !== false &&
          (!onlyDoctorId || t.doctorId === onlyDoctorId),
      ),
    [therapists, onlyDoctorId],
  );

  // Colour every cell by the therapist's EXISTING occupancy, independent of the
  // chosen duration: probe a minimal visit at each slot with the same span logic
  // the confirm step uses. "overlap" = busy (can't start here), "too-close" =
  // within the booking gap (still clickable, soft-warn), "ok" = free.
  const occupancy = useMemo(() => {
    const map = new Map<string, ConflictResult>();
    for (const t of all) {
      const doctorId = t.doctorId as string;
      for (const cell of TIME_SLOTS) {
        map.set(
          `${doctorId}|${cell}`,
          checkConflict(
            { doctorId, date, startTime: cell, durationMin: 1 },
            appointments,
            gap,
            { excludeId: excludeRecordId },
          ),
        );
      }
    }
    return map;
  }, [all, appointments, date, gap, excludeRecordId]);

  // Search matches name OR specialization, so an executive can find "who does
  // Electrotherapy?" without opening the Therapists page.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        (t.specialization ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [all, query]);

  // Check which therapists are off on the selected date (weekly off-days + leave blocks)
  const offDayDoctorIds = useMemo(() => {
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const ids = new Set<string>();

    // Weekly off-days
    for (const t of all) {
      if (t.weekOffDays?.includes(dayOfWeek)) {
        ids.add(t.doctorId as string);
      }
    }

    // One-off leave blocks covering this date
    for (const leave of allLeaves) {
      if (leave.startDate <= date && leave.endDate >= date) {
        ids.add(leave.doctorId);
      }
    }

    return ids;
  }, [all, allLeaves, date]);

  if (all.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No therapists on file yet - add one on the Therapists page.
      </p>
    );
  }

  // The chosen span, for shading the cells a booking of this length would cover.
  const selectedStartMin = selectedStart ? toMinutes(selectedStart) : NaN;
  const selectedEndMin = Number.isNaN(selectedStartMin)
    ? NaN
    : selectedStartMin + durationMin;

  return (
    <div className="space-y-2">
      {!onlyDoctorId && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Filter by name or specialization…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!onlyDoctorId && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Duration</span>
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDurationChange(d)}
              aria-pressed={durationMin === d}
              className={cn(
                "rounded border px-2 py-1",
                durationMin === d
                  ? "border-primary bg-primary/10"
                  : "hover:bg-muted/50",
            )}
          >
            {d}m
          </button>
        ))}
      </div>
      )}

      <div className="rounded-md border">
        <div className="max-h-72 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-background">
              <tr>
                <th className="sticky left-0 z-30 bg-background border-b border-r px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Therapist
                </th>
                {TIME_SLOTS.map((t) => (
                  <th
                    key={t}
                    className="border-b px-1 py-1.5 font-normal tabular-nums text-muted-foreground"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={TIME_SLOTS.length + 1}
                    className="px-2 py-3 text-center text-muted-foreground"
                  >
                    No therapist matches &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
              {rows.map((therapist) => {
                const doctorId = therapist.doctorId as string;
                const isOffDay = offDayDoctorIds.has(doctorId);
                return (
                  <tr key={doctorId}>
                    <td className="sticky left-0 z-10 bg-background border-r px-2 py-1">
                      <TherapistNameCell therapist={therapist} />
                    </td>
                    {TIME_SLOTS.map((cell) => {
                      const probe = occupancy.get(`${doctorId}|${cell}`);
                      const status = probe?.status ?? "ok";
                      const isBusy = status === "overlap";
                      const isTooClose = status === "too-close";
                      // Compared as minutes: a time input gives "09:30", the grid "9:30".
                      const cellMin = toMinutes(cell);
                      const isSelected =
                        selectedDoctorId === doctorId &&
                        cellMin === selectedStartMin;
                      // Cells the chosen span rolls over, between start and end.
                      const isCovered =
                        selectedDoctorId === doctorId &&
                        !Number.isNaN(selectedStartMin) &&
                        cellMin > selectedStartMin &&
                        cellMin < selectedEndMin;
                      return (
                        <td key={cell} className="p-0.5 text-center">
                          <button
                            type="button"
                            disabled={isBusy || isOffDay}
                            title={
                              isOffDay
                                ? `${therapist.name} is off on this day`
                                : isBusy
                                  ? `Booked - ${probe?.with?.name ?? "existing visit"}`
                                  : isTooClose
                                    ? `${therapist.name} · ${cell} - within the ${gap}-min booking gap`
                                    : `${therapist.name} · ${cell}`
                            }
                            aria-label={`${therapist.name} at ${cell}${
                              isOffDay
                                ? " (day off)"
                                : isBusy
                                  ? " (booked)"
                                  : isTooClose
                                    ? " (within booking gap)"
                                    : ""
                            }`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              onPick({
                                doctorId,
                                doctor: therapist.name ?? "",
                                startTime: cell,
                                durationMin,
                              })
                            }
                            className={cn(
                              "h-6 w-full min-w-[2.25rem] rounded-sm border transition-colors",
                              isOffDay
                                ? "cursor-not-allowed border-transparent bg-red-500/10 text-red-400/50"
                                : isBusy
                                  ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/40"
                                  : isTooClose
                                    ? "border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/30 dark:text-amber-400"
                                    : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25",
                              isCovered &&
                                !isSelected &&
                                "border-primary/40 bg-primary/20",
                              isSelected &&
                                "border-primary bg-primary text-primary-foreground hover:bg-primary",
                            )}
                          >
                            {isSelected
                              ? "✓"
                              : isOffDay
                                ? "-"
                                : isBusy
                                  ? "×"
                                  : isTooClose
                                    ? "!"
                                    : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t px-2 py-1.5 text-[10px] text-muted-foreground">
          Click a free slot to set the therapist and start time. × = booked, ! =
          within the {gap}-min booking gap, - = day off. Click a name for their
          specializations.
        </p>
      </div>
    </div>
  );
}

/**
 * Therapist name + their specializations on demand. Some therapists carry a
 * dozen specializations, so they can't sit inline - the popover keeps the grid
 * compact while saving a trip to the Therapists page.
 */
function TherapistNameCell({ therapist }: { therapist: TherapistformType }) {
  const tags = therapist.specialization ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex max-w-[10rem] items-center gap-1.5 text-left hover:underline"
          title="Show specializations"
        >
          <span className="truncate">{therapist.name}</span>
          {tags.length > 0 && (
            <span className="shrink-0 rounded-full border px-1 text-[9px] text-muted-foreground">
              {tags.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2">
        <div>
          <p className="text-sm font-medium">{therapist.name}</p>
          <p className="text-[11px] capitalize text-muted-foreground">
            {[therapist.gender, therapist.phonenumber]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((s) => (
              <span
                key={s}
                className="rounded-full border bg-muted/50 px-1.5 py-0.5 text-[10px]"
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No specializations listed.
          </p>
        )}
        {therapist.bio && (
          <p className="border-t pt-2 text-[11px] text-muted-foreground">
            {therapist.bio}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
