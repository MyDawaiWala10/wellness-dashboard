"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshButton } from "@/components/refresh-button";
import { formatINR } from "@/components/pages/services/services-columns";

import RecentSalesTable from "./dashboard-recent-sales-table";
import {
  deriveDashboardTotals,
  deriveTherapistPersonal,
} from "./dashboard-metrics";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";
import { QueryWrapper } from "@/components/query-wrapper";
import { useAuthStore } from "@/providers/permission-provider";
import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import { useGetServices } from "@/data/service/service";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import type { EnquiryType } from "@/type/schema";

function TotalsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="border border-border p-5 rounded-xl h-24 space-y-3"
        >
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-8 w-1/3 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

const DashboardPageComponents = () => {
  const { user } = useAuthStore();
  const { id, role, userEmail } = user || {};
  const queryClient = useQueryClient();

  // All totals are derived client-side from the lists the app already fetches.
  const enq = useGetAllEnquiries({ role, id, userEmail });
  const therapists = useGetAllTherapist();
  const services = useGetServices();

  const records = React.useMemo(
    () => (enq.data ?? []) as EnquiryType[],
    [enq.data],
  );

  const isTherapist = role === "THERAPIST";

  const totals = React.useMemo(
    () =>
      deriveDashboardTotals(
        records,
        (therapists.data ?? []) as { isActive?: boolean }[],
        services.data?.length ?? 0,
      ),
    [records, therapists.data, services.data],
  );

  const personal = React.useMemo(
    () => deriveTherapistPersonal(records),
    [records],
  );

  const loading =
    enq.isLoading ||
    (!isTherapist && (therapists.isLoading || services.isLoading));
  const isFetching =
    enq.isFetching || therapists.isFetching || services.isFetching;

  function handleRefresh() {
    for (const key of ["enquiries", "therapists", "services", "appointments"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  return (
    <div className="w-full flex flex-col justify-center items-center gap-6 px-3 sm:px-4 md:px-8 pt-10">
      <div className="flex justify-between items-center w-full">
        <h1 className="text-3xl md:text-4xl font-bold">Dashboard</h1>

        <RefreshButton
          onClick={handleRefresh}
          isFetching={isFetching}
          label="Refresh dashboard"
        />
      </div>

      <QueryWrapper
        isLoading={loading}
        isError={enq.isLoadingError}
        error={enq.error}
        onRetry={enq.refetch}
        skeleton={<TotalsSkeleton />}
      >
        {isTherapist ? (
          <MetricCardsRow className="w-full">
            <MetricCard label="Today's sessions" value={personal.todaySessions} />
            <MetricCard label="Completed today" value={personal.completedToday} />
            <MetricCard
              label="Recommendations made"
              value={personal.recommendations}
            />
            <MetricCard label="Open assigned" value={personal.openAssigned} />
          </MetricCardsRow>
        ) : (
          <MetricCardsRow className="w-full">
            <MetricCard
              label="Revenue"
              value={formatINR(totals.totalRevenue)}
            />
            <MetricCard label="Total Therapists" value={totals.totalTherapists} />
            <MetricCard label="Active Therapists" value={totals.activeTherapists} />
            <MetricCard label="Total Customers" value={totals.totalCustomers} />
            <MetricCard label="Total Enquiries" value={totals.totalEnquiries} />
            <MetricCard
              label="Total Appointments"
              value={totals.totalAppointments}
            />
            <MetricCard
              label="Completed Appointments"
              value={totals.completedAppointments}
            />
            <MetricCard label="Total Services" value={totals.totalServices} />
            <MetricCard label="Open Follow-ups" value={totals.openFollowUps} />
          </MetricCardsRow>
        )}
      </QueryWrapper>

      <div className="flex flex-col xl:flex-row w-full">
        <RecentSalesTable />
      </div>
    </div>
  );
};

export default DashboardPageComponents;
