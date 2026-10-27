"use client";

import { useMemo } from "react";
import { topLevelRows } from "@/lib/visit-groups";
import { isToday } from "date-fns";
import AppointmentBookingForm from "./appointmentbookingform";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";
import { isTodayISO, readCreatedISO } from "@/lib/metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppointmentDataTable } from "./Appoinmentsdatatable";
import { useAuthStore } from "@/providers/permission-provider";
import { makeAppointmentColumns } from "./appoitmentstable";
import { useGetAllAppointments } from "@/data/appointment/appointment";
import { useGetServices } from "@/data/service/service";
import { QueryWrapper } from "@/components/query-wrapper";

function AppointmentTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 6 }).map((_, j) => (
            <div
              key={j}
              className="h-8 flex-1 rounded bg-muted animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SlotBookingPage() {
  const { user } = useAuthStore();
  const { id, role, userEmail } = user || {};
  const {
    data: appointments,
    isLoading,
    isLoadingError: isError,
    error,
    refetch,
  } = useGetAllAppointments({ role, id, userEmail });
  const { data: services = [] } = useGetServices();

  const columns = useMemo(
    () => makeAppointmentColumns(appointments ?? [], services, role === "SUPER_ADMIN"),
    [appointments, services, role],
  );

  const apptTodayStats = useMemo(() => {
    const recs = appointments ?? [];
    return {
      newToday: recs.filter((r) => isTodayISO(readCreatedISO(r))).length,
      sessionsToday: recs.filter((r) => {
        const d = r.slot?.date ? new Date(r.slot.date) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        return isToday(d);
      }).length,
      completedToday: recs.filter((r) => isTodayISO(r.completedAt)).length,
      paymentsToday: recs.filter((r) => isTodayISO(r.paymentReceivedAt)).length,
    };
  }, [appointments]);

  return (
    <>
      <MetricCardsRow className="mb-4">
        <MetricCard
          label="New appointments today"
          value={apptTodayStats.newToday}
        />
        <MetricCard
          label="Today's sessions"
          value={apptTodayStats.sessionsToday}
          hint="Scheduled for today"
        />
        <MetricCard
          label="Completed today"
          value={apptTodayStats.completedToday}
        />
        <MetricCard
          label="Payments received today"
          value={apptTodayStats.paymentsToday}
        />
      </MetricCardsRow>
      <Card>
      <CardHeader className="flex flex-row flex-wrap justify-start items-center gap-2">
        <div className="flex flex-col gap-2">
          <CardTitle>Appointments</CardTitle>
          <CardDescription>Manage all your appointments.</CardDescription>
        </div>
        {role !== "THERAPIST" && (
          <div className="ml-auto flex items-center gap-2">
            <AppointmentBookingForm />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <QueryWrapper
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          skeleton={<AppointmentTableSkeleton />}
        >
          {/* A booking's later visits (add-on sessions, course follow-ups)
              live inside it (Sessions tab), not as extra rows. */}
          <AppointmentDataTable
            columns={columns}
            data={topLevelRows(appointments ?? [])}
            allAppointments={appointments ?? []}
            // A therapist works by visit date: today's visits first, whenever
            // the lead came in. The office keeps newest booking first.
            defaultSorting={
              role === "THERAPIST" ? [{ id: "nextVisit", desc: false }] : undefined
            }
          />
        </QueryWrapper>
      </CardContent>
    </Card>
    </>
  );
}
