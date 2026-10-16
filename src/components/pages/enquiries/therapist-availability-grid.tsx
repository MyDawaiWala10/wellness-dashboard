"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  conflictMessage,
  firstBookableDay,
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
];

/** Assignable visit lengths, in minutes. */
const DURATION_OPTIONS = [30, 60, 90, 120];

/** How a slot looks, shared by the grid and the day picker so they match. */
const SLOT_STYLE = {
  off: "cursor-not-allowed border-transparent bg-red-500/10 text-red-400/50",
  busy: "cursor-not-allowed border-transparent bg-muted text-muted-foreground/40",
  tooClose: "cursor-not-allowed border-transparent bg-amber-500/10 text-amber-700/60 dark:text-amber-400/60",
  free: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25",
  covered: "border-primary/40 bg-primary/20",
  picked: "border-primary bg-primary text-primary-foreground hover:bg-primary",
};

interface TherapistAvailabilityGridProps {
  /** The picked day, "yyyy-MM-dd". */
  date: string;
  /** Currently chosen therapist, so their cell can be shown as selected. */
  selectedDoctorId?: string;
  /** The chosen START time, "HH:MM" - the grid shades the span it covers. */
  selectedStart?: string;
  /** This enquiry's own record - its slot must not count against itself. */
  excludeRecordId?: string;
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
 * Whether a visit of `durationMin` can START at each slot, for every active
 * therapist on one day, plus who is off. Shared by the all-therapists grid and
 * the one-therapist day picker so both read availability the same way.
 */
function useDayAvailability(date: string, durationMin: number, excludeRecordId?: string) {
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

  const all = useMemo(
    () =>
      ((therapists ?? []) as TherapistformType[]).filter(
        (t) => t.doctorId && t.isActive !== false,
      ),
    [therapists],
  );

  // Probe a visit of the chosen length at each slot, with the same check the
  // confirm step uses. "overlap" = it would run into a visit, "too-close" = it
  // would leave less than the booking gap; both are blocked (client rule, no
  // override). "ok" = free.
  const occupancy = useMemo(() => {
    const map = new Map<string, ConflictResult>();
    for (const t of all) {
      const doctorId = t.doctorId as string;
      for (const cell of TIME_SLOTS) {
        map.set(
          `${doctorId}|${cell}`,
          checkConflict(
            { doctorId, date, startTime: cell, durationMin },
            appointments,
            gap,
            { excludeId: excludeRecordId },
          ),
        );
      }
    }
    return map;
  }, [all, appointments, date, durationMin, gap, excludeRecordId]);

  // Who is off on this date (weekly off-days + leave blocks).
  const offDayDoctorIds = useMemo(() => {
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const ids = new Set<string>();
    for (const t of all) {
      if (t.weekOffDays?.includes(dayOfWeek)) ids.add(t.doctorId as string);
    }
    for (const leave of allLeaves) {
      if (leave.startDate <= date && leave.endDate >= date) ids.add(leave.doctorId);
    }
    return ids;
  }, [all, allLeaves, date]);

  return { all, occupancy, offDayDoctorIds, gap, appointments };
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
  durationMin,
  onDurationChange,
  onPick,
}: TherapistAvailabilityGridProps) {
  const { all, occupancy, offDayDoctorIds, gap } = useDayAvailability(date, durationMin, excludeRecordId);
  const [query, setQuery] = useState("");

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
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Filter by name or specialization…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

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
                      // Ends after 8:30 PM, or today after 8:30 PM.
                      const isClosed = status === "after-hours" || status === "closed";
                      const isSelected =
                        selectedDoctorId === doctorId &&
                        selectedStart === cell;
                      // Cells the chosen span rolls over, between start and end.
                      const cellMin = toMinutes(cell);
                      const isCovered =
                        selectedDoctorId === doctorId &&
                        !Number.isNaN(selectedStartMin) &&
                        cellMin > selectedStartMin &&
                        cellMin < selectedEndMin;
                      return (
                        <td key={cell} className="p-0.5 text-center">
                          <button
                            type="button"
                            disabled={isBusy || isTooClose || isClosed || isOffDay}
                            title={
                              isOffDay
                                ? `${therapist.name} is off on this day`
                                : isClosed
                                  ? status === "closed"
                                    ? "Bookings for today closed at 8:30 PM"
                                    : `Visits must finish by 8:30 PM - ${durationMin} min from ${cell} runs past it`
                                : isBusy
                                  ? `Booked - ${probe?.with?.name ?? "existing visit"}`
                                  : isTooClose
                                    ? `${therapist.name} · ${cell} - needs the ${gap}-min gap to ${probe?.with?.name ?? "another"}'s ${probe?.with?.time ?? ""} visit`
                                    : `${therapist.name} · ${cell}`
                            }
                            aria-label={`${therapist.name} at ${cell}${
                              isOffDay
                                ? " (day off)"
                                : isBusy
                                  ? " (booked)"
                                  : isTooClose
                                    ? " (too close to another visit)"
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
                                ? SLOT_STYLE.off
                                : isBusy || isClosed
                                  ? SLOT_STYLE.busy
                                  : isTooClose
                                    ? SLOT_STYLE.tooClose
                                    : SLOT_STYLE.free,
                              isCovered && !isSelected && SLOT_STYLE.covered,
                              isSelected && SLOT_STYLE.picked,
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
          too close to another visit (needs a {gap}-min gap), - = day off, grey =
          past 8:30 PM. Click a name for their specializations.
        </p>
      </div>
    </div>
  );
}

/**
 * One therapist's day as tappable times, with ‹ › to move a day at a time.
 * For picking when a therapist does something themselves (an add-on), where
 * the whole-team grid is more than they need. Same availability as the grid.
 */
export function TherapistDayPicker({
  doctorId,
  date,
  onDateChange,
  selectedStart,
  durationMin,
  onDurationChange,
  excludeRecordId,
  onPick,
}: {
  doctorId: string;
  /** The day shown, "yyyy-MM-dd". */
  date: string;
  onDateChange: (date: string) => void;
  /** The picked start, "HH:MM". */
  selectedStart?: string;
  durationMin: number;
  onDurationChange: (d: number) => void;
  /** A booking whose own visit shouldn't count as busy. */
  excludeRecordId?: string;
  /** Gets "HH:MM" (zero-padded). */
  onPick: (startTime: string) => void;
}) {
  const { occupancy, offDayDoctorIds, gap, appointments } = useDayAvailability(
    date,
    durationMin,
    excludeRecordId,
  );
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  // From 8:30 PM today can't be booked, so the earliest day is tomorrow.
  const firstDay = firstBookableDay(now);
  // Earlier today can't be picked.
  const nowMin = date === today ? now.getHours() * 60 + now.getMinutes() : -1;
  const startMin = selectedStart ? toMinutes(selectedStart) : NaN;

  // The chosen time can stop fitting (the length went up, or it was a default):
  // say why, and clear it so nothing can be booked until a free time is tapped.
  const [warning, setWarning] = useState<string | null>(null);
  const problem = !selectedStart
    ? null
    : startMin <= nowMin
      ? `${selectedStart} has already passed. Pick another time.`
      : conflictMessage(
          checkConflict(
            { doctorId, date, startTime: selectedStart, durationMin },
            appointments,
            gap,
            { excludeId: excludeRecordId },
          ),
          selectedStart,
          durationMin,
          gap,
        );
  useEffect(() => {
    if (!problem) return;
    setWarning(problem);
    onPick("");
  }, [problem]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (startTime: string) => {
    setWarning(null);
    onPick(startTime);
  };
  const changeDay = (next: string) => {
    setWarning(null);
    onDateChange(next);
  };
  const moveDay = (days: number) =>
    changeDay(format(addDays(parseISO(date), days), "yyyy-MM-dd"));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          aria-label="Previous day"
          disabled={date <= firstDay}
          onClick={() => moveDay(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          aria-label="Day"
          className="h-8 w-auto"
          min={firstDay}
          value={date}
          onChange={(e) => e.target.value && changeDay(e.target.value)}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          aria-label="Next day"
          onClick={() => moveDay(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Select value={String(durationMin)} onValueChange={(v) => onDurationChange(Number(v))}>
          <SelectTrigger className="ml-auto h-8 w-24" aria-label="Length">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {offDayDoctorIds.has(doctorId) ? (
        <p className="text-xs text-muted-foreground">Day off. Try another day.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {TIME_SLOTS.map((cell) => {
            const status = occupancy.get(`${doctorId}|${cell}`)?.status ?? "ok";
            const cellMin = toMinutes(cell);
            const past = cellMin <= nowMin;
            const busy = status === "overlap";
            const tooClose = status === "too-close";
            const closed = status === "after-hours" || status === "closed";
            const taken = past || busy || tooClose || closed;
            const picked = cellMin === startMin;
            const covered = cellMin > startMin && cellMin < startMin + durationMin;
            return (
              <button
                key={cell}
                type="button"
                disabled={taken}
                aria-pressed={picked}
                aria-label={`${cell}${taken ? " (not available)" : ""}`}
                title={
                  past
                    ? "Already passed"
                    : closed
                      ? status === "closed"
                        ? "Bookings for today closed at 8:30 PM"
                        : "Would end after 8:30 PM"
                      : busy
                      ? "Runs into another visit"
                      : tooClose
                        ? `Needs a ${gap}-min gap to another visit`
                        : undefined
                }
                onClick={() => pick(cell.padStart(5, "0"))}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-xs tabular-nums transition-colors",
                  past || busy || closed ? SLOT_STYLE.busy : tooClose ? SLOT_STYLE.tooClose : SLOT_STYLE.free,
                  covered && !picked && SLOT_STYLE.covered,
                  picked && SLOT_STYLE.picked,
                )}
              >
                {cell}
                {picked ? " ✓" : busy ? " ×" : tooClose ? " !" : ""}
              </button>
            );
          })}
        </div>
      )}
      {warning && (
        <p role="alert" className="text-xs text-destructive">
          {warning}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Tap a time. × = booked, ! = too close to another visit (needs a {gap}-min gap). Visits end by 8:30 PM.
      </p>
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
