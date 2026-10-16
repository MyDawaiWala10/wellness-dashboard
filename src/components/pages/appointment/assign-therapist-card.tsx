"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateAppointment } from "@/data/appointment/appointment";
import { useGetClinicSettings } from "@/data/clinic-settings/clinic-settings";
import { useAuthStore } from "@/providers/permission-provider";
import type { slotBookingZodType } from "@/type/schema";
import { TherapistAvailabilityGrid } from "@/components/pages/enquiries/therapist-availability-grid";
import { checkConflict, conflictMessage, toMinutes } from "@/lib/booking-conflicts";
import { toDayKey } from "@/components/pages/enquiries/booking";

/**
 * Who is doing this visit, and when - assign, or change it when they can't make it.
 *
 * Handles both states in one place. Assigning used to be the whole tab, which
 * meant the picker vanished the instant a slot was chosen (the record now had a
 * therapist) and an assigned booking could never be reassigned at all.
 *
 * Reuses the same availability grid and conflict check as the enquiry funnel and
 * the booking modal, so a slot taken here can't collide with one taken there.
 * Pay-first still applies: the server refuses to attach a therapist to an unpaid
 * booking, so this explains that rather than showing a grid that would fail.
 */
export function AssignTherapistCard({
  appointment,
  allAppointments,
  isCompleted,
}: {
  appointment: slotBookingZodType;
  allAppointments: slotBookingZodType[];
  isCompleted?: boolean;
}) {
  const { user } = useAuthStore();
  const isTherapist = user?.role === "THERAPIST";
  const { mutate: update, isPending } = useUpdateAppointment();
  const { data: clinicSettings } = useGetClinicSettings();
  const gapMinutes = clinicSettings?.bookingGapMinutes ?? 60;

  const assigned = !!appointment.doctorId;
  const [changing, setChanging] = useState(false);
  const [date, setDate] = useState(
    toDayKey(appointment.slot?.date) || format(new Date(), "yyyy-MM-dd"),
  );
  const [durationMin, setDurationMin] = useState(60);

  // Assigned and not being changed: show who and when, with a way out.
  if (assigned && !changing) {
    return (
      <div className={`flex items-center gap-3 rounded-lg border p-3 ${isCompleted ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{appointment.doctor}</p>
          <p className="text-[11px] text-muted-foreground">
            {appointment.slot?.date
              ? format(new Date(appointment.slot.date), "dd MMM yyyy")
              : "no date"}
            {appointment.slot?.time ? ` at ${appointment.slot.time}` : ""}
          </p>
        </div>
        {!isTherapist && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={() => setChanging(true)}
          >
            Change
          </Button>
        )}
      </div>
    );
  }

  function assign(pick: { doctorId: string; doctor: string; startTime: string }) {
    const startMin = toMinutes(pick.startTime);
    const endMin = startMin + durationMin;
    const end = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(
      endMin % 60,
    ).padStart(2, "0")}`;

    const conflict = checkConflict(
      { doctorId: pick.doctorId, date, startTime: pick.startTime, durationMin },
      allAppointments,
      gapMinutes,
      { excludeId: appointment._id },
    );
    const blocked = conflictMessage(conflict, pick.startTime, durationMin, gapMinutes);
    if (blocked) {
      toast.error(blocked);
      return;
    }

    const previous = appointment.doctor;
    update(
      {
        ...appointment,
        doctorId: pick.doctorId,
        doctor: pick.doctor,
        slot: { date, time: pick.startTime },
        therapyStartTime: pick.startTime,
        therapyEndTime: end,
        activityLog: [
          ...(appointment.activityLog ?? []),
          {
            at: new Date().toISOString(),
            userId: user?.id,
            name:
              `${user?.userfName ?? ""} ${user?.userlName ?? ""}`.trim() ||
              "Someone",
            action: previous
              ? `Reassigned ${previous} to ${pick.doctor} - ${date} ${pick.startTime}-${end}`
              : `Assigned ${pick.doctor} - ${date} ${pick.startTime}-${end}`,
          },
        ],
      },
      {
        onSuccess: () => {
          setChanging(false);
          toast.success(`${pick.doctor} - ${date} at ${pick.startTime}`);
        },
      },
    );
  }

  return (
    <div className={`space-y-2 rounded-lg border p-3 ${isCompleted ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold">
            {assigned ? "Change therapist" : "Assign a therapist"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {assigned
              ? `Currently ${appointment.doctor}. Pick a date, then a free slot.`
              : "Pick a date, then a free slot. Busy and too-close slots are blocked."}
          </p>
        </div>
        {assigned && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0"
            onClick={() => setChanging(false)}
          >
            Cancel
          </Button>
        )}
      </div>
      <Input
        type="date"
        className="h-8 w-full sm:w-44"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        min={new Date().toISOString().split("T")[0]}
        aria-label="Visit date"
      />
      <TherapistAvailabilityGrid
        date={date}
        selectedDoctorId={appointment.doctorId}
        selectedStart={appointment.slot?.time}
        excludeRecordId={appointment._id}
        durationMin={durationMin}
        onDurationChange={setDurationMin}
        onPick={({ doctorId, doctor, startTime }) => {
          if (isPending) return;
          assign({ doctorId, doctor, startTime });
        }}
      />
    </div>
  );
}
