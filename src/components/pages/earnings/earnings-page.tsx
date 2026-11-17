"use client";

import { useMemo, useState } from "react";
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  TrendingUp,
  Wallet,
  Building2,
  BarChart3,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Download,
  Sparkles,
  CalendarClock,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import {
  buildEarningRows,
  canManageSplit,
  computeEarningsSummary,
  isUpcoming,
  type EarningRow,
} from "@/lib/earnings";
import type { slotBookingZodType } from "@/type/schema";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { PayoutBalances } from "./payout-balances";
import {
  ColumnCell,
  ColumnHead,
  useColumnWidths,
  type ColumnWidths,
} from "@/components/tables/resizable-columns";

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
  showDiscount,
  cols,
}: {
  row: EarningRow;
  isAdmin: boolean;
  showDiscount: boolean;
  cols: ColumnWidths;
}) {
  const dateStr = row.date
    ? (() => {
        try {
          return format(parseISO(row.date), "dd MMM yyyy");
        } catch {
          return row.date;
        }
      })()
    : "-";

  return (
    <TableRow>
      <ColumnCell columnId="date" cols={cols} className="text-muted-foreground">
        {dateStr}
        {isUpcoming(row) && (
          <Badge variant="outline" className="ml-2 text-[11px] font-medium text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-800">
            Upcoming
          </Badge>
        )}
      </ColumnCell>
      <ColumnCell columnId="booking" cols={cols} >
        {row.enquiryId ? (
          <BookingIdBadge record={row} />
        ) : (
          <span className="text-foreground">
            {row.appointmentId.slice(-6)}
          </span>
        )}
      </ColumnCell>
      <ColumnCell columnId="customer" cols={cols} className="font-medium text-foreground">{row.customerName}</ColumnCell>
      {isAdmin && (
        <ColumnCell columnId="therapist" cols={cols} className="font-medium text-foreground">{row.therapistName}</ColumnCell>
      )}
      <ColumnCell columnId="custPayment" cols={cols} className="text-center">
        {row.paymentReceived ? (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-semibold px-2 py-0.5">
            Customer Paid
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[11px] font-semibold px-2 py-0.5">
            Customer Pending
          </Badge>
        )}
      </ColumnCell>
      <ColumnCell columnId="service" cols={cols} className="max-w-[180px] truncate text-muted-foreground font-medium">
        {row.service}
      </ColumnCell>
      <ColumnCell columnId="sessions" cols={cols} className="text-center tabular-nums">{row.sessionsCompleted}</ColumnCell>
      <ColumnCell columnId="revenue" cols={cols} className="text-right tabular-nums font-medium text-foreground">
        <span className={!row.paymentReceived ? "text-amber-600 dark:text-amber-400" : undefined}>
          {fmt(row.revenue)}
        </span>
      </ColumnCell>
      {showDiscount && <ColumnCell columnId="discount" cols={cols} className="text-right tabular-nums text-xs">
        {row.discountAmount > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {fmt(row.discountAmount)}
            {row.discountCode ? (
              <span className="text-muted-foreground ml-1">({row.discountCode})</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </ColumnCell>}
      <ColumnCell columnId="cut" cols={cols} className="text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
        {/* Therapists aren't sent the split, so "no split" is a null split with no cut. */}
        {row.splitPercent == null && row.therapistCut === 0 ? (
          <span className="text-muted-foreground font-normal">-</span>
        ) : (
          fmt(row.therapistCut)
        )}
      </ColumnCell>
      {isAdmin && (
        <ColumnCell columnId="company" cols={cols} className="text-right tabular-nums text-indigo-700 dark:text-indigo-300 font-medium">
          {fmt(row.companyCut)}
        </ColumnCell>
      )}
    </TableRow>
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
    "Sessions", "Original Price", "Discount", "Revenue", "Therapist Cut", isAdmin ? "Company Cut" : null, "Customer Payment",
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
        ? `₹${r.discountAmount}${r.discountCode ? ` (${r.discountCode})` : ""}`
        : "",
      r.revenue,
      r.therapistCut,
      isAdmin ? r.companyCut : null,
      r.paymentReceived ? "Paid" : "Pending",
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
  const canPay = canManageSplit(user?.role);

  // Every row, not the Appointments list's one-row-per-package view: each
  // session of a course earns on its own row.
  const { data: appointments = [], isLoading: apptLoading, isLoadingError: apptError, error: apptErr, refetch } =
    useGetAllEnquiries(user as any);
  // Names for the therapist filter.
  const { data: therapists = [] } = useGetAllTherapist();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [therapistFilter, setTherapistFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "pending">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  // ── Rows ─────────────────────────────────────────────────────────────────
  // A therapist is only sent their own payout parts, so no client-side filter.
  const allRows = useMemo(
    () => buildEarningRows(appointments as slotBookingZodType[]),
    [appointments],
  );

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


    return sortRows(rows, sortKey, sortAsc);
  }, [allRows, dateFrom, dateTo, therapistFilter, serviceFilter, paymentFilter, sortKey, sortAsc, isAdmin]);

  const summary = useMemo(() => computeEarningsSummary(filtered), [filtered]);
  // Drag a header edge to resize; remembered per table in this browser.
  const cols = useColumnWidths("earnings");
  // Discount is "-" on almost every row; drop the column when nothing in view has one.
  const showDiscount = filtered.some((r) => r.discountAmount > 0);
  const columnCount = (isAdmin ? 11 : 9) - (showDiscount ? 0 : 1);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3 inline stroke-[3]" /> : <ChevronDown className="h-3 w-3 inline stroke-[3]" />;
  }


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

      {/* What's left to settle with each therapist, after the cash they hold.
          Admins see everyone; a therapist themself; other roles nothing. */}
      {(canPay || user?.role === "THERAPIST") && (
        <PayoutBalances isAdmin={canPay} from={dateFrom || undefined} to={dateTo || undefined} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <KpiCard
          title="Total Revenue"
          value={fmt(summary.totalRevenue)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />}
          accent="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800"
          sub="Sessions done and paid for"
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
          title={isAdmin ? "Therapist Payout" : "Earned"}
          value={fmt(summary.totalTherapistPayout)}
          icon={<Wallet className="h-4 w-4 text-sky-600 dark:text-sky-400 stroke-[2.5]" />}
          accent="bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800"
          sub="Cut of done, paid sessions"
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
          title="Upcoming"
          value={fmt(isAdmin ? summary.upcomingRevenue : summary.upcomingTherapistCut)}
          icon={<CalendarClock className="h-4 w-4 text-sky-600 dark:text-sky-400 stroke-[2.5]" />}
          accent="bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800"
          sub={`${summary.upcomingSessions} booking${summary.upcomingSessions === 1 ? "" : "s"} with sessions to come`}
        />
        <KpiCard
          title="Sessions"
          value={String(summary.completedSessions)}
          icon={<CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 stroke-[2.5]" />}
          accent="bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800"
          sub="Done"
        />
        <KpiCard
          title="Avg / Session"
          value={fmt(summary.avgPerSession)}
          icon={<BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400 stroke-[2.5]" />}
          accent="bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800"
          sub="Per done session, paid or not"
        />
      </div>

      {/* Filters */}
      <Card className="shadow-2xs">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3.5 items-end">
            <div className="space-y-1">
              <Label className="text-muted-foreground">From</Label>
              <Input
                type="date"
                className="h-9 w-36 text-xs font-medium"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">To</Label>
              <Input
                type="date"
                className="h-9 w-36 text-xs font-medium"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {isAdmin && (
              <div className="space-y-1">
                <Label className="text-muted-foreground">Therapist</Label>
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
              <Label className="text-muted-foreground">Service</Label>
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
              <Label className="text-muted-foreground">Cust. Payment</Label>
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
            {(dateFrom || dateTo || therapistFilter !== "all" || serviceFilter !== "all" || paymentFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs font-semibold mt-5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                onClick={() => {
                  setDateFrom(""); setDateTo(""); setTherapistFilter("all");
                  setServiceFilter("all"); setPaymentFilter("all");
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
            <Table>
              <TableHeader>
                <TableRow>
                  <ColumnHead columnId="date" cols={cols}
                    className="text-left cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => toggleSort("date")}
                  >
                    Date <SortIcon k="date" />
                  </ColumnHead>
                  <ColumnHead columnId="booking" cols={cols} className="text-left">Booking</ColumnHead>
                  <ColumnHead columnId="customer" cols={cols} className="text-left">Customer</ColumnHead>
                  {isAdmin && <ColumnHead columnId="therapist" cols={cols} className="text-left">Therapist</ColumnHead>}
                  <ColumnHead columnId="custPayment" cols={cols} className="text-center">Cust. Payment</ColumnHead>
                  <ColumnHead columnId="service" cols={cols} className="text-left">Service</ColumnHead>
                  <ColumnHead columnId="sessions" cols={cols}
                    className="text-center cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("sessionsCompleted")}
                  >
                    Sessions <SortIcon k="sessionsCompleted" />
                  </ColumnHead>
                  <ColumnHead columnId="revenue" cols={cols}
                    className="text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => toggleSort("revenue")}
                  >
                    Revenue <SortIcon k="revenue" />
                  </ColumnHead>
                  {showDiscount && <ColumnHead columnId="discount" cols={cols} className="text-right">Discount</ColumnHead>}
                  <ColumnHead columnId="cut" cols={cols}
                    className="text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                    onClick={() => toggleSort("therapistCut")}
                  >
                    {isAdmin ? "Therapist Cut" : "Your Earnings"} <SortIcon k="therapistCut" />
                  </ColumnHead>
                  {isAdmin && (
                    <ColumnHead columnId="company" cols={cols}
                      className="text-right cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                      onClick={() => toggleSort("companyCut")}
                    >
                      Company Cut <SortIcon k="companyCut" />
                    </ColumnHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="py-12 text-center text-muted-foreground font-medium"
                    >
                      No earnings data matching the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <EarningsTableRow
                      key={`${row.appointmentId}-${row.therapistId}`}
                      row={row}
                      isAdmin={isAdmin}
                      showDiscount={showDiscount}
                      cols={cols}
                    />
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-muted-foreground">
                      Earned totals (sessions done and paid for)
                    </TableCell>
                    <ColumnCell columnId="revenue" cols={cols} className="text-right tabular-nums text-foreground font-semibold">
                      {fmt(summary.totalRevenue)}
                    </ColumnCell>
                    {/* Discount has no total; the cell keeps later totals under their columns. */}
                    {showDiscount && <ColumnCell columnId="discount" cols={cols} />}
                    <ColumnCell columnId="cut" cols={cols} className="text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                      {fmt(summary.totalTherapistPayout)}
                    </ColumnCell>
                    {isAdmin && (
                      <ColumnCell columnId="company" cols={cols} className="text-right tabular-nums text-indigo-700 dark:text-indigo-300 font-semibold">
                        {fmt(summary.totalCompanyEarnings)}
                      </ColumnCell>
                    )}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </Card>
      </QueryWrapper>
    </div>
  );
}
