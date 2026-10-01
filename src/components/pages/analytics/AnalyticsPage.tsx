"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RefreshButton } from "@/components/refresh-button";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";
import { QueryWrapper } from "@/components/query-wrapper";
import { formatINR } from "@/components/pages/services/services-columns";
import { useAuthStore } from "@/providers/permission-provider";
import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import { therapistSplits } from "@/lib/earnings";
import type { EnquiryType } from "@/type/schema";

import { deriveAnalytics, deriveMoM } from "./analytics-metrics";
import { MoMGrowthChart } from "./MoMGrowthChart";
import { DailyPacingChart } from "./DailyPacingChart";

const PRIMARY = "#0284c7";
const EMERALD = "#059669";
const AMBER = "#d97706";
const SLICE_COLORS = [PRIMARY, EMERALD, AMBER, "#8b5cf6", "#ec4899", "#64748b"];
const AXIS = "#94a3b8";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};
const inrTip = (v: unknown) => formatINR(Number(v ?? 0));

// Compact money for chart axes / MoM cards: ₹18.8k, -₹30.6k, ₹700.
const inrK = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  return a >= 1000 ? `${s}₹${(a / 1000).toFixed(1)}k` : `${s}₹${Math.round(a)}`;
};
const inrDelta = (d: number) => `${d > 0 ? "+" : ""}${inrK(d)}`;
const num = (n: number) => `${Math.round(n)}`;
const withUnit = (unit: string) => (n: number) => `${Math.round(n)} ${unit}`;
const deltaUnit = (unit: string) => (d: number) =>
  `${d > 0 ? "+" : ""}${Math.round(d)}${unit ? ` ${unit}` : ""}`;

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 w-full">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border border-border p-5 rounded-xl h-64 space-y-3">
          <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-44 w-full rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ZoneTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

const AnalyticsPage = () => {
  const { user } = useAuthStore();
  const { id, role, userEmail } = user || {};
  const queryClient = useQueryClient();

  const enq = useGetAllEnquiries({ role, id, userEmail });
  const records = React.useMemo(
    () => (enq.data ?? []) as EnquiryType[],
    [enq.data],
  );
  const { data: therapists = [] } = useGetAllTherapist();
  const a = React.useMemo(
    () => deriveAnalytics(records, therapistSplits(therapists as any[])),
    [records, therapists],
  );
  const mom = React.useMemo(() => deriveMoM(records), [records]);

  // Analytics is a back-office view; therapists get their own dashboard.
  // ponytail: nav/role visibility only - real enforcement is server-side when
  // the access model needs it (see spec §4).
  if (role === "THERAPIST") {
    return (
      <div className="w-full px-4 md:px-8 pt-10">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-4 text-muted-foreground">
          Analytics is available to owners and back-office staff.
        </p>
      </div>
    );
  }

  const mixData = a.serviceMix.map((m) => ({ name: m.label, value: m.revenue }));
  const splitData = [
    { name: "Collected", value: a.collected },
    { name: "Pending", value: a.pending },
  ];
  const pipelineData = [
    { name: "Enquiries", value: a.pipeline.enquiries, fill: "#94a3b8" },
    { name: "Bookings", value: a.pipeline.bookings, fill: PRIMARY },
    { name: "Paid", value: a.pipeline.paid, fill: EMERALD },
  ];
  const loadData = a.therapistLoad.map((t) => ({ name: t.name, value: t.bookings }));
  const maxLoad = Math.max(1, ...a.therapistLoad.map((t) => t.bookings));

  return (
    <div className="w-full flex flex-col gap-8 px-3 sm:px-4 md:px-8 pt-10 pb-16">
      <div className="flex justify-between items-center w-full">
        <h1 className="text-3xl md:text-4xl font-bold">Analytics</h1>
        <RefreshButton
          onClick={() => queryClient.invalidateQueries({ queryKey: ["enquiries"] })}
          isFetching={enq.isFetching}
          label="Refresh analytics"
        />
      </div>

      <QueryWrapper
        isLoading={enq.isLoading}
        isError={enq.isError}
        error={enq.error}
        onRetry={enq.refetch}
        skeleton={<AnalyticsSkeleton />}
      >
        {!a.hasData ? (
          <Empty>Not enough data yet - analytics fill in as bookings arrive.</Empty>
        ) : (
          <>
            {/* ── Business health ── */}
            <section className="space-y-4">
              <ZoneTitle>Business health</ZoneTitle>
              <MetricCardsRow className="w-full">
                <MetricCard label="Revenue this month" value={formatINR(a.revenueThisMonth)} />
                <MetricCard
                  label="Collected"
                  value={`${formatINR(a.collected)} · ${Math.round(a.collectedPct)}%`}
                />
                <MetricCard label="Bookings this month" value={a.bookingsThisMonth} />
                <MetricCard label="Conversion" value={`${Math.round(a.conversionPct)}%`} />
              </MetricCardsRow>

              <MoMGrowthChart
                title="MoM Revenue Growth"
                subtitle="Revenue growth compared with the previous month."
                data={mom.revenue}
                formatValue={inrK}
                formatAxis={inrK}
                formatDelta={inrDelta}
              />
              <MoMGrowthChart
                title="MoM Bookings Growth"
                subtitle="Booking volume compared with the previous month."
                data={mom.bookings}
                formatValue={withUnit("bookings")}
                formatAxis={num}
                formatDelta={deltaUnit("")}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Revenue by service">
                  {mixData.length === 0 ? (
                    <Empty>No collected revenue yet.</Empty>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={mixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                          >
                            {mixData.map((_, i) => (
                              <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v, n) => [inrTip(v), n]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {mixData.map((m, i) => (
                          <span key={m.name} className="flex items-center gap-1.5 text-xs">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                            />
                            {m.name} · {formatINR(m.value)}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>

                <Panel title="Collected vs pending" hint="Money in vs still owed">
                  {a.collected + a.pending === 0 ? (
                    <Empty>No booked revenue yet.</Empty>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={splitData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                          >
                            <Cell fill={EMERALD} />
                            <Cell fill={AMBER} />
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v, n) => [inrTip(v), n]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EMERALD }} />
                          Collected · {formatINR(a.collected)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: AMBER }} />
                          Pending · {formatINR(a.pending)}
                        </span>
                      </div>
                    </>
                  )}
                </Panel>
              </div>
            </section>

            {/* ── Customers ── */}
            <section className="space-y-4">
              <ZoneTitle>Customers</ZoneTitle>
              <MoMGrowthChart
                title="MoM New Customer Growth"
                subtitle="First-time customers compared with the previous month."
                data={mom.newCustomers}
                formatValue={withUnit("new")}
                formatAxis={num}
                formatDelta={deltaUnit("new")}
              />
              <MoMGrowthChart
                title="MoM Repeat Customer Growth"
                subtitle="Returning customers compared with the previous month."
                data={mom.repeatCustomers}
                formatValue={withUnit("repeat")}
                formatAxis={num}
                formatDelta={deltaUnit("repeat")}
              />
            </section>

            {/* ── Earnings Breakdown ── */}
            <section className="space-y-4">
              <ZoneTitle>Earnings & Payout Breakdown</ZoneTitle>
              <MetricCardsRow className="w-full">
                <MetricCard
                  label="Therapist Payouts"
                  value={formatINR(a.therapistPayoutTotal)}
                  hint={`Paid: ${formatINR(a.therapistPayoutPaid)}`}
                />
                <MetricCard
                  label="Company Earnings"
                  value={formatINR(a.companyEarningsTotal)}
                  hint="Margin after therapist split"
                />
                <MetricCard
                  label="Payout Owed"
                  value={formatINR(a.therapistPayoutOwed)}
                  hint="Unpaid payouts to therapists"
                />
              </MetricCardsRow>

              <Panel title="Earnings breakdown by therapist" hint="Collected revenue and therapist vs company split">
                {a.therapistEarningsBreakdown.length === 0 ? (
                  <Empty>No therapist earnings recorded yet.</Empty>
                ) : (
                  <div className="space-y-3.5">
                    {a.therapistEarningsBreakdown.map((t) => (
                      <div key={t.name} className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 text-xs gap-2">
                        <div>
                          <p className="font-bold text-sm text-foreground">{t.name}</p>
                          <p className="text-muted-foreground font-medium">
                            Revenue: <span className="font-bold text-foreground">{formatINR(t.revenue)}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                          <div className="text-right">
                            <p className="text-muted-foreground font-medium">Therapist Cut</p>
                            <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{formatINR(t.therapistCut)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground font-medium">Company Cut</p>
                            <p className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">{formatINR(t.companyCut)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground font-medium">Paid / Owed</p>
                            <p className="font-bold text-sm">
                              <span className="text-emerald-700 dark:text-emerald-400">{formatINR(t.paidCut)}</span>
                              {" / "}
                              <span className="text-rose-700 dark:text-rose-400">{formatINR(t.owedCut)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            {/* ── Operational ── */}
            <section className="space-y-4">
              <ZoneTitle>Operational</ZoneTitle>
              <DailyPacingChart records={records} formatValue={inrK} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <MetricCard
                  label="Pending payments"
                  value={`${formatINR(a.pending)} · ${a.pendingCount} booking${a.pendingCount === 1 ? "" : "s"}`}
                />
                <MetricCard label="Needs first contact" value={a.needsFirstContact} />
                <MetricCard
                  label="Therapists booked this week"
                  value={a.therapistLoad.length}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Pipeline" hint="Enquiry → Booking → Paid">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={pipelineData} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: AXIS }}
                        tickLine={false}
                        axisLine={false}
                        width={72}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                        {pipelineData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                        <LabelList dataKey="value" position="right" fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                <Panel title="Therapist load" hint="Bookings this week">
                  {loadData.length === 0 ? (
                    <Empty>No therapist bookings scheduled this week.</Empty>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(160, loadData.length * 44)}>
                      <BarChart data={loadData} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12, fill: AXIS }}
                          tickLine={false}
                          axisLine={false}
                          width={120}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
                        <Bar dataKey="value" fill={PRIMARY} radius={[0, 6, 6, 0]} barSize={22}>
                          <LabelList dataKey="value" position="right" fontSize={12} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>
              </div>
            </section>
          </>
        )}
      </QueryWrapper>
    </div>
  );
};

export default AnalyticsPage;
