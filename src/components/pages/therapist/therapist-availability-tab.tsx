"use client";

import { useState } from "react";
import { Loader2, Trash2, Plus, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useGetTherapistLeaves,
  useCreateTherapistLeave,
  useDeleteTherapistLeave,
  useUpdateWeekOffDays,
} from "@/data/therapist/therapist-leaves";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import { CalendarGrid } from "./therapist-calendar-grid";
import type { TherapistformType } from "@/type/schema";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TherapistAvailabilityTabProps {
  doctorId: string;
  /** Initial value from parent, but overridden by fresh query data. */
  weekOffDays: number[];
  /** A therapist looking at a colleague: see the days off, change nothing. */
  readOnly?: boolean;
}

export function TherapistAvailabilityTab({
  doctorId,
  weekOffDays: initialWeekOffDays,
  readOnly = false,
}: TherapistAvailabilityTabProps) {
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [reason, setReason] = useState("");

  // Fetch fresh therapist data to get current weekOffDays
  const { data: therapists = [] } = useGetAllTherapist();
  const therapist = (therapists as TherapistformType[]).find(
    (t) => t.doctorId === doctorId,
  );
  // Use fresh data if available, fall back to prop
  const weekOffDays = therapist?.weekOffDays ?? initialWeekOffDays;

  const { data: leaves = [], isLoading } = useGetTherapistLeaves(doctorId);
  const createLeave = useCreateTherapistLeave();
  const deleteLeave = useDeleteTherapistLeave();
  const updateWeekOff = useUpdateWeekOffDays();

  function toggleDay(day: number) {
    const next = weekOffDays.includes(day)
      ? weekOffDays.filter((d) => d !== day)
      : [...weekOffDays, day];
    updateWeekOff.mutate({ doctorId, weekOffDays: next });
  }

  function handleAddLeave() {
    if (!newStart) return;
    createLeave.mutate(
      {
        doctorId,
        startDate: newStart,
        endDate: newEnd || newStart,
        reason,
      },
      {
        onSuccess: () => {
          setNewStart("");
          setNewEnd("");
          setReason("");
        },
      },
    );
  }

  function handleCalendarDayClick(dateStr: string) {
    setNewStart(dateStr);
    setNewEnd("");
  }

  return (
    <div className="space-y-6">
      {/* ── Calendar ──────────────────────────────────────────── */}
      <CalendarGrid
        weekOffDays={weekOffDays}
        leaves={leaves}
        onDayClick={readOnly ? undefined : handleCalendarDayClick}
      />

      {/* A colleague's schedule can be browsed above but not changed here. */}
      <fieldset disabled={readOnly} className="min-w-0 space-y-6">

      {/* ── Weekly off-days ──────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Weekly off-days</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recurring days this therapist is unavailable.
          </p>
        </div>
        <div className="flex gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const active = weekOffDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                disabled={updateWeekOff.isPending}
                className={`w-10 h-10 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                  active
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {weekOffDays.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Off on:{" "}
            {weekOffDays
              .sort()
              .map((d) => DAY_LABELS[d])
              .join(", ")}
          </p>
        )}
      </section>

      {/* ── One-off date blocks ──────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Date blocks</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            One-off leave periods (vacation, sick days, etc.). Click a date on
            the calendar to pre-fill the start date.
          </p>
        </div>

        {/* Add form */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="h-8 w-36"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              min={newStart || undefined}
              className="h-8 w-36"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground">Reason</label>
            <Input
              placeholder="Optional"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-8"
            />
          </div>
          <Button
            size="sm"
            className="h-8"
            disabled={!newStart || createLeave.isPending}
            onClick={handleAddLeave}
          >
            {createLeave.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Existing blocks */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <CalendarOff className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No date blocks yet</p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {leaves.map((leave) => (
              <div
                key={leave._id}
                className="flex items-center justify-between px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {formatDate(leave.startDate)}
                    {leave.endDate !== leave.startDate &&
                      ` - ${formatDate(leave.endDate)}`}
                  </p>
                  {leave.reason && (
                    <p className="text-xs text-muted-foreground">
                      {leave.reason}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={deleteLeave.isPending}
                  onClick={() =>
                    deleteLeave.mutate({ id: leave._id, doctorId })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      </fieldset>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
