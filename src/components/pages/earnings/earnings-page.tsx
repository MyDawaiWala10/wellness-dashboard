"use client";

import { useMemo, useState } from "react";
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  TrendingUp,
  Wallet,
  Building2,
  Clock,
  BarChart3,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Download,
  Check,
  XCircle,
  Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueryWrapper } from "@/components/query-wrapper";
import { useAuthStore } from "@/providers/permission-provider";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import { useGetAllAppointments, useUpdateAppointment } from "@/data/appointment/appointment";
import {
  buildEarningRows,
  computeEarningsSummary,
  therapistSplits,
  type EarningRow,
} from "@/lib/earnings";
import { toast } from "sonner";
import { BookingIdBadge } from "@/components/booking-id-badge";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon,
  sub,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <span className={`rounded-lg p-2 ${accent ?? "bg-muted text-foreground"}`}>{icon}</span>
      </CardHeader>
      <CardContent className="pt-1">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground font-medium mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Table row ───────────────────────────────────────────────────────────────

function EarningsTableRow({
  row,
  isAdmin,
  onToggleTherapistPaid,
  isUpdating,
}: {
  row: EarningRow;
  isAdmin: boolean;
  onToggleTherapistPaid?: (row: EarningRow) => void;
  isUpdating?: boolean;
}) {
  const dateStr = row.date
    ? (() => {
        try {
          return format(parseISO(row.date), "dd MMM yyyy");
        } catch {
          return row.date;
        }
      })()
    : "—";

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors text-sm">
      <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {dateStr}
      </td>
      <td className="px-3 py-3">
        {row.enquiryId ? (
          <BookingIdBadge record={row} />
        ) : (
          <span className="font-mono text-xs font-medium text-foreground">
            {row.appointmentId.slice(-6)}
          </span>
        )}
      </td>
      <td className="px-3 py-3 font-semibold text-foreground">{row.customerName}</td>
      {isAdmin && (
        <td className="px-3 py-3 font-medium text-foreground">{row.therapistName}</td>
      )}
      <td className="px-3 py-3 max-w-[180px] truncate text-muted-foreground font-medium">
        {row.service}
      </td>
      <td className="px-3 py-3 text-center tabular-nums font-semibold">{row.sessionsCompleted}</td>
      <td className="px-3 py-3 text-right tabular-nums font-bold text-foreground">
        <span className={!row.paymentReceived ? "text-amber-600 dark:text-amber-400" : undefined}>
          {fmt(row.revenue)}
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-xs">
        {row.discountAmount > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {row.discountType === "percent"
              ? `${row.discountAmount}%`
              : fmt(row.discountAmount)}
            {row.discountCode ? (
              <span className="text-muted-foreground ml-1">({row.discountCode})</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
        {row.splitPercent == null ? (
          <span className="text-muted-foreground font-normal">-</span>
        ) : (
          fmt(row.therapistCut)
        )}
      </td>
      {isAdmin && (
        <td className="px-3 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-300 font-bold">
          {fmt(row.companyCut)}
        </td>
      )}
      <td className="px-3 py-3 text-center">
        {row.paymentReceived ? (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-semibold px-2 py-0.5">
            Customer Paid
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[11px] font-semibold px-2 py-0.5">
            Customer Pending
          </Badge>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {isAdmin ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdating}
            onClick={() => onToggleTherapistPaid?.(row)}
            className="h-8 px-2.5 text-xs font-semibold shadow-2xs transition-all hover:scale-105"
          >
            {row.therapistPaid ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold">
                <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> Paid
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold">
                <XCircle className="h-3.5 w-3.5 text-rose-600 stroke-[2.5]" /> Mark Paid
              </span>
            )}
          </Button>
        ) : (
          row.therapistPaid ? (
            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2 py-0.5 gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> Paid
            </Badge>
          ) : (
            <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950 dark:text-rose-300 text-[11px] font-bold px-2 py-0.5">
              Pending Payout
            </Badge>
          )
        )}
      </td>
    </tr>
  );
}

// ─── Sort helper ─────────────────────────────────────────────────────────────

type SortKey = "date" | "revenue" | "therapistCut" | "companyCut" | "sessionsCompleted";

function sortRows(rows: EarningRow[], key: SortKey, asc: boolean): EarningRow[] {
  return [...rows].sort((a, b) => {
    let diff = 0;
    if (key === "date") {
      diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else {
      diff = (a[key] as number) - (b[key] as number);
    }
    return asc ? diff : -diff;
  });
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

function exportCsv(rows: EarningRow[], isAdmin: boolean) {
  const headers = [
    "Date", "Booking ID", "Customer", isAdmin ? "Therapist" : null, "Service",
    "Sessions", "Original Price", "Discount", "Revenue", "Therapist Cut", isAdmin ? "Company Cut" : null, "Customer Payment", "Therapist Payout Status",
  ].filter(Boolean) as string[];

  const csvRows = rows.map((r) =>
    [
      r.date ? format(parseISO(r.date), "dd MMM yyyy") : "",
      r.enquiryId || r.appointmentId,
      r.customerName,
      isAdmin ? r.therapistName : null,
      r.service,
      r.sessionsCompleted,
      r.originalPrice,
      r.discountAmount > 0
        ? `${r.discountType === "percent" ? `${r.discountAmount}%` : `₹${r.discountAmount}`}${r.discountCode ? ` (${r.discountCode})` : ""}`
        : "",
      r.revenue,
      r.therapistCut,
      isAdmin ? r.companyCut : null,
      r.paymentReceived ? "Paid" : "Pending",
      r.therapistPaid ? "Paid to Therapist" : "Owed to Therapist",
    ]
      .filter((v) => v !== null)
      .join(","),
  );

  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `earnings-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EarningsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role !== "THERAPIST";

  const { data: appointments = [], isLoading: apptLoading, isError: apptError, error: apptErr, refetch } =
    useGetAllAppointments(user as any);
  const { data: therapists = [] } = useGetAllTherapist();

  const updateApptMutation = useUpdateAppointment({ silent: true });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Local overrides for instant UI response on payout toggle
  const [localPaidOverrides, setLocalPaidOverrides] = useState<Record<string, boolean>>({});

  // ── Filters ──────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [therapistFilter, setTherapistFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "pending">("all");
  const [payoutFilter, setPayoutFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const splits = useMemo(() => therapistSplits(therapists as any[]), [therapists]);

  // ── Raw rows with local override ─────────────────────────────────────────
  const allRows = useMemo(() => {
    // Backend already filters to only this therapist's appointments when
    // role=THERAPIST, so no client-side filter needed.
    const appts = appointments as any[];
    
    const rows = buildEarningRows(appts, splits);
    return rows.map((r) => {
      if (r.appointmentId in localPaidOverrides) {
        return { ...r, therapistPaid: localPaidOverrides[r.appointmentId] };
      }
      return r;
    });
  }, [appointments, splits, localPaidOverrides]);

  // ── Unique services for filter ────────────────────────────────────────────
  const services = useMemo(
    () => [...new Set(allRows.map((r) => r.service).filter(Boolean))],
    [allRows],
  );

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = allRows;

    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      rows = rows.filter((r) => r.date && !isBefore(parseISO(r.date), from));
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      rows = rows.filter((r) => r.date && !isAfter(parseISO(r.date), to));
    }
    if (isAdmin && therapistFilter !== "all") {
      rows = rows.filter((r) => r.therapistId === therapistFilter);
    }
    if (serviceFilter !== "all") {
      rows = rows.filter((r) => r.service === serviceFilter);
    }
    if (paymentFilter === "paid") rows = rows.filter((r) => r.paymentReceived);
    if (paymentFilter === "pending") rows = rows.filter((r) => !r.paymentReceived);

    if (payoutFilter === "paid") rows = rows.filter((r) => r.therapistPaid);
    if (payoutFilter === "unpaid") rows = rows.filter((r) => !r.therapistPaid);

    return sortRows(rows, sortKey, sortAsc);
  }, [allRows, dateFrom, dateTo, therapistFilter, serviceFilter, paymentFilter, payoutFilter, sortKey, sortAsc, isAdmin]);

  const summary = useMemo(() => computeEarningsSummary(filtered), [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3 inline stroke-[3]" /> : <ChevronDown className="h-3 w-3 inline stroke-[3]" />;
  }

  const handleToggleTherapistPaid = async (row: EarningRow) => {
    if (!isAdmin) return;
    const newStatus = !row.therapistPaid;
    
    // Instant local override
    setLocalPaidOverrides((prev) => ({ ...prev, [row.appointmentId]: newStatus }));
    setUpdatingId(row.appointmentId);

    try {
      // Send clean patch object to server
      const result = await updateApptMutation.mutateAsync({
        _id: row.appointmentId,
        therapistPaid: newStatus,
        therapistPaidAt: newStatus ? new Date().toISOString() : (null as any),
      } as any);

      if (result) {
        toast.success(newStatus ? "Marked payout as Paid" : "Marked payout as Owed");
        refetch();
      }
    } catch (err: any) {
      // Rollback local state on error
      setLocalPaidOverrides((prev) => ({ ...prev, [row.appointmentId]: !newStatus }));
      toast.error("Failed to update payout status: " + (err?.message || "Server error"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {isAdmin ? "Earnings & Payouts" : "My Earnings"}
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            {isAdmin
              ? "Comprehensive financial breakdown & therapist payout management"
              : "Track your completed sessions, rate splits, and payouts"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(filtered, isAdmin)}
          disabled={filtered.length === 0}
          className="font-semibold"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <KpiCard
          title="Total Revenue"
          value={fmt(summary.totalRevenue)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />}
          accent="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800"
          sub="Collected payments"
        />
        {summary.totalDiscountGiven > 0 && (
          <KpiCard
            title="Discount Given"
            value={fmt(summary.totalDiscountGiven)}
            icon={<Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 stroke-[2.5]" />}
            accent="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800"
            sub={`Original: ${fmt(summary.totalOriginalRevenue)}`}
          />
        )}
        <KpiCard
          title="Therapist Payout"
          value={fmt(summary.totalTherapistPayout)}
          icon={<Wallet className="h-4 w-4 text-sky-600 dark:text-sky-400 stroke-[2.5]" />}
          accent="bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800"
          sub={`Paid: ${fmt(summary.therapistPaidPayout)}`}
        />
        {isAdmin && (
          <KpiCard
            title="Company Earnings"
            value={fmt(summary.totalCompanyEarnings)}
            icon={<Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />}
            accent="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800"
            sub={`${summary.totalRevenue > 0 ? Math.round((summary.totalCompanyEarnings / summary.totalRevenue) * 100) : 0}% margin`}
          />
        )}
        <KpiCard
          title="Payout Owed"
          value={fmt(summary.therapistUnpaidPayout)}
          icon={<Clock className="h-4 w-4 text-rose-600 dark:text-rose-400 stroke-[2.5]" />}
          accent="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800"
          sub="Therapist unpaid total"
        />
        <KpiCard
          title="Sessions"
          value={String(summary.completedSessions)}
          icon={<CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 stroke-[2.5]" />}
          accent="bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800"
          sub="Completed"
        />
        <KpiCard
          title="Avg / Session"
          value={fmt(summary.avgPerSession)}
          icon={<BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400 stroke-[2.5]" />}
          accent="bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800"
          sub="Collected revenue"
        />
      </div>

      {/* Filters */}
      <Card className="shadow-2xs">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3.5 items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</label>
              <Input
                type="date"
                className="h-9 w-36 text-xs font-medium"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</label>
              <Input
                type="date"
                className="h-9 w-36 text-xs font-medium"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {isAdmin && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Therapist</label>
                <Select value={therapistFilter} onValueChange={setTherapistFilter}>
                  <SelectTrigger className="h-9 w-40 text-xs font-medium">
                    <SelectValue placeholder="All therapists" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All therapists</SelectItem>
                    {(therapists as any[]).map((t) => (
                      <SelectItem key={t.doctorId} value={t.doctorId}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service</label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="h-9 w-44 text-xs font-medium">
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cust. Payment</label>
              <Select
                value={paymentFilter}
                onValueChange={(v) => setPaymentFilter(v as typeof paymentFilter)}
              >
                <SelectTrigger className="h-9 w-36 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                  <SelectItem value="pending">Pending only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Therapist Payout</label>
              <Select
                value={payoutFilter}
                onValueChange={(v) => setPayoutFilter(v as typeof payoutFilter)}
              >
                <SelectTrigger className="h-9 w-40 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid to Therapist</SelectItem>
                  <SelectItem value="unpaid">Owed to Therapist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(dateFrom || dateTo || therapistFilter !== "all" || serviceFilter !== "all" || paymentFilter !== "all" || payoutFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs font-semibold mt-5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                onClick={() => {
                  setDateFrom(""); setDateTo(""); setTherapistFilter("all");
                  setServiceFilter("all"); setPaymentFilter("all"); setPayoutFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-3">
            Showing <span className="font-bold text-foreground">{filtered.length}</span> record{filtered.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <QueryWrapper
        isLoading={apptLoading}
        isError={apptError}
        error={apptErr as Error}
        onRetry={refetch}
      >
        <Card className="overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  <th
                    className="px-3 py-3 text-left cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => toggleSort("date")}
                  >
                    Date <SortIcon k="date" />
                  </th>
                  <th className="px-3 py-3 text-left">Booking</th>
                  <th className="px-3 py-3 text-left">Customer</th>
                  {isAdmin && <th className="px-3 py-3 text-left">Therapist</th>}
                  <th className="px-3 py-3 text-left">Service</th>
                  <th
                    className="px-3 py-3 text-center cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("sessionsCompleted")}
                  >
                    Sessions <SortIcon k="sessionsCompleted" />
                  </th>
                  <th
                    className="px-3 py-3 text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => toggleSort("revenue")}
                  >
                    Revenue <SortIcon k="revenue" />
                  </th>
                  <th className="px-3 py-3 text-right">Discount</th>
                  <th
                    className="px-3 py-3 text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => toggleSort("therapistCut")}
                  >
                    {isAdmin ? "Therapist Cut" : "Your Earnings"} <SortIcon k="therapistCut" />
                  </th>
                  {isAdmin && (
                    <th
                      className="px-3 py-3 text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                      onClick={() => toggleSort("companyCut")}
                    >
                      Company Cut <SortIcon k="companyCut" />
                    </th>
                  )}
                  <th className="px-3 py-3 text-center">Cust. Payment</th>
                  <th className="px-3 py-3 text-center">Therapist Payout</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 12 : 10}
                      className="px-3 py-12 text-center text-muted-foreground font-medium"
                    >
                      No earnings data matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <EarningsTableRow
                      key={row.appointmentId + row.date}
                      row={row}
                      isAdmin={isAdmin}
                      onToggleTherapistPaid={handleToggleTherapistPaid}
                      isUpdating={updatingId === row.appointmentId}
                    />
                  ))
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/40 font-bold text-sm">
                    <td colSpan={isAdmin ? 6 : 5} className="px-3 py-3 text-muted-foreground uppercase text-xs tracking-wider">
                      Totals ({filtered.length} rows)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground font-extrabold">
                      {fmt(summary.totalRevenue)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-extrabold">
                      {fmt(summary.totalTherapistPayout)}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-300 font-extrabold">
                        {fmt(summary.totalCompanyEarnings)}
                      </td>
                    )}
                    <td />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </QueryWrapper>
    </div>
  );
}
