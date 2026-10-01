"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useGetAllTherapist,
  useGetPersonalAppointments,
  useUpdateTherapist,
} from "@/data/therapist/therapist";
import { useAuthStore } from "@/providers/permission-provider";
import {
  buildEarningRows,
  canManageSplit,
  computeEarningsSummary,
  therapistSplits,
} from "@/lib/earnings";
import type { slotBookingZodType, TherapistformType } from "@/type/schema";

interface TherapistEarningsTabProps {
  doctorId: string;
}

export function TherapistEarningsTab({ doctorId }: TherapistEarningsTabProps) {
  const { user } = useAuthStore();
  // Therapists never see split percentages, only their earnings.
  const showSplit = canManageSplit(user?.role);
  const { data: appointments = [], isLoading } =
    useGetPersonalAppointments(doctorId);
  // Read from the live list (not the drawer's snapshot) so a saved split
  // shows up straight away.
  const { data: therapists = [] } = useGetAllTherapist();
  const therapist = (therapists as TherapistformType[]).find(
    (t) => t.doctorId === doctorId,
  );

  const rows = useMemo(() => {
    const list: slotBookingZodType[] = Array.isArray(appointments)
      ? appointments
      : [];
    return buildEarningRows(list, therapistSplits(therapists as TherapistformType[]));
  }, [appointments, therapists]);

  const summary = useMemo(() => computeEarningsSummary(rows), [rows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading earnings...
      </div>
    );
  }

  const splitEditor = showSplit && therapist && <SplitEditor therapist={therapist} />;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {splitEditor}
        <div className="text-center py-12 text-muted-foreground text-sm">
          No completed sessions yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {splitEditor}
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total sessions" value={String(summary.completedSessions)} />
        <StatCard
          label="Total revenue"
          value={`₹${summary.totalRevenue.toLocaleString()}`}
        />
        {summary.totalDiscountGiven > 0 && (
          <>
            <StatCard
              label="Original price"
              value={`₹${summary.totalOriginalRevenue.toLocaleString()}`}
            />
            <StatCard
              label="Discount given"
              value={`₹${summary.totalDiscountGiven.toLocaleString()}`}
              accent="amber"
            />
          </>
        )}
        <StatCard
          label="Therapist earned"
          value={`₹${summary.totalTherapistPayout.toLocaleString()}`}
        />
        <StatCard
          label="Paid out"
          value={`₹${summary.therapistPaidPayout.toLocaleString()}`}
          accent="emerald"
        />
        <StatCard
          label="Pending payout"
          value={`₹${summary.therapistUnpaidPayout.toLocaleString()}`}
          accent="amber"
        />
        <StatCard
          label="Avg / session"
          value={`₹${summary.avgPerSession.toLocaleString()}`}
        />
      </div>

      {/* Session list */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Session history
        </h4>
        <div className="divide-y rounded-md border">
          {rows.map((row) => {
            const isCompleted = row.status === "completed";
            const isOngoing = row.status === "ongoing";
            const statusLabel = isCompleted
              ? "Completed"
              : isOngoing
                ? "Ongoing"
                : "Scheduled";
            const statusColor = isCompleted
              ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : isOngoing
                ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                : "text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800";

            return (
              <div
                key={row.appointmentId}
                className="flex items-center justify-between px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.service}
                    {row.date
                      ? ` · ${new Date(row.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusColor}`}>
                      {statusLabel}
                    </span>
                    {row.discountAmount > 0 && (
                      <span className="text-[10px] text-emerald-600">
                        {row.discountType === "percent"
                          ? `${row.discountAmount}% off`
                          : `₹${row.discountAmount} off`}
                        {row.discountCode ? ` (${row.discountCode})` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`text-sm font-semibold ${row.revenue > 0 ? "" : "text-muted-foreground"}`}>
                    {row.revenue > 0 ? `₹${row.revenue.toLocaleString()}` : "—"}
                  </p>
                  {showSplit && row.revenue > 0 && row.splitPercent != null && (
                    <p className="text-xs text-muted-foreground">
                      {row.splitPercent}% split
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Admin / Super Admin only: this therapist's share of collected revenue.
 * Applies to sessions completed from now on; each completed booking keeps the
 * split it was completed at.
 */
function SplitEditor({ therapist }: { therapist: TherapistformType }) {
  const { mutate, isPending } = useUpdateTherapist();
  const saved = therapist.splitPercent ?? null;
  const [value, setValue] = useState(saved == null ? "" : String(saved));
  useEffect(() => {
    setValue(saved == null ? "" : String(saved));
  }, [saved]);

  const split = Number(value);
  const valid = value !== "" && split >= 0 && split <= 100;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="split-percent" className="text-sm font-medium whitespace-nowrap">
        Earnings split %
      </label>
      <Input
        id="split-percent"
        type="number"
        min={0}
        max={100}
        placeholder="Not set"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 w-24"
      />
      <Button
        size="sm"
        disabled={isPending || !valid || split === saved}
        onClick={() => mutate({ ...therapist, splitPercent: split })}
      >
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "amber"
        ? "text-amber-600"
        : "text-foreground";

  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1">
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
