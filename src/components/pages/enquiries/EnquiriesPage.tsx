"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";
import {
  playEnquiryBeep,
  isEnquirySoundMuted,
  setEnquirySoundMuted,
} from "@/lib/notification-sound";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/tables/data-table-pagination";
import { QueryWrapper } from "@/components/query-wrapper";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/providers/permission-provider";
import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import getAllAppointments from "@/actions/appointments/get-all-appointments";
import type { EnquiryType } from "@/type/schema";

import { makeEnquiryColumns } from "./enquiries-columns";
import { EnquiryIntakeModal } from "./enquiry-intake-modal";
import { EnquiryDetailDrawer } from "./enquiry-detail-drawer";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  deriveStage,
  type FunnelStage,
} from "./stage";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";
import { isTodayISO, readCreatedISO } from "@/lib/metrics";

const COLLAPSED_ATTENDED_ROWS = 5;

/** Stale thresholds - rows older than these get an amber highlight. */
const UNTOUCHED_STALE_MS = 24 * 60 * 60 * 1000; // 1 day
const ATTENDED_STALE_MS = 48 * 60 * 60 * 1000; // 2 days

/** Stages considered "active" in the attended pile (i.e. still need work).
 *  "assigned" is terminal here - the enquiry's job ends once a therapist is
 *  on it; the booking is Appointments work from then on. */
const ATTENDED_NON_TERMINAL_STAGES = new Set<FunnelStage>([
  "reached_out",
  "booked",
  "paid",
]);

function readTimestamp(
  r: EnquiryType,
  key: "createdAt" | "updatedAt",
): number {
  const ts = (r as unknown as Record<string, string | undefined>)[key];
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** A "needs first contact" lead is stale if it was created more than 24h ago. */
function isStaleUntouched(r: EnquiryType): boolean {
  const created = readTimestamp(r, "createdAt");
  if (!created) return false;
  return Date.now() - created > UNTOUCHED_STALE_MS;
}

/** An "attended" lead is stale if it hasn't been updated in 48h AND
 *  it's not already in a terminal state (assigned / cancelled / completed). */
function isStaleAttended(r: EnquiryType): boolean {
  const stage = deriveStage(r);
  if (!ATTENDED_NON_TERMINAL_STAGES.has(stage)) return false;
  if (r.status === "completed") return false;
  const updated = readTimestamp(r, "updatedAt");
  if (!updated) return false;
  return Date.now() - updated > ATTENDED_STALE_MS;
}

const STALE_ROW_CLASS =
  "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500";

function EnquiriesTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 7 }).map((_, j) => (
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

interface SectionTableProps {
  records: EnquiryType[];
  columns: ColumnDef<EnquiryType>[];
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  paginated?: boolean;
  /** Optional per-row className - used to highlight stale rows in amber. */
  rowClassName?: (record: EnquiryType) => string;
  /** Click anywhere on a row to open it (matches the other dashboard tables). */
  onRowClick?: (record: EnquiryType) => void;
  /** Column IDs that should be hidden by default in this section. Used by
   *  the top section to hide funnel-checkpoint columns that are always
   *  empty for untouched leads. User can still toggle them on via the
   *  Columns menu if we ever add one. */
  hiddenColumnIds?: string[];
  /** Hide the built-in search input (use when search is rendered externally). */
  hideSearch?: boolean;
}

/**
 * Self-contained table block used for both the "Needs first contact" and
 * "Attended" sections. Each instance owns its own sort/visibility state so
 * the two tables sort and filter independently.
 */
export function SectionTable({
  records,
  columns,
  search,
  onSearchChange,
  searchPlaceholder,
  emptyMessage,
  paginated = false,
  rowClassName,
  onRowClick,
  hiddenColumnIds,
  hideSearch = false,
}: SectionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const initialVisibility = useMemo<VisibilityState>(() => {
    if (!hiddenColumnIds?.length) return {};
    return Object.fromEntries(hiddenColumnIds.map((id) => [id, false]));
  }, [hiddenColumnIds]);
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(initialVisibility);

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
      globalFilter: search,
    },
    onGlobalFilterChange: onSearchChange,
    globalFilterFn: (row, _columnId, value) => {
      const q = String(value).toLowerCase();
      if (!q) return true;
      const r = row.original as EnquiryType;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        String(r.phonenumber ?? "").includes(q)
      );
    },
  });

  return (
    <>
      {!hideSearch && (
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
          {search && (
            <Button variant="ghost" onClick={() => onSearchChange("")}>
              Clear
            </Button>
          )}
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={
                    `${onRowClick ? "cursor-pointer " : ""}${
                      rowClassName?.(row.original) ?? ""
                    }`.trim() || undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {paginated && (
        <div className="mt-4">
          <DataTablePagination table={table} />
        </div>
      )}
    </>
  );
}

export default function EnquiriesPage() {
  const { user } = useAuthStore();
  const { id, role, userEmail } = user || {};
  const isSuperAdmin = role === "SUPER_ADMIN";
  const {
    data: allRecords,
    isLoading,
    isLoadingError: isError,
    error,
    refetch,
    isFetching,
  } = useGetAllEnquiries({ role, id, userEmail });

  const [openDetail, setOpenDetail] = useState<EnquiryType | null>(null);
  const [topSearch, setTopSearch] = useState("");
  const [bottomSearch, setBottomSearch] = useState("");
  const [bottomExpanded, setBottomExpanded] = useState(false);
  const [attendedStageFilter, setAttendedStageFilter] = useState<
    FunnelStage | "all"
  >("all");

  // ── New-enquiry notification + manual reload (pull-based) ──
  // We don't auto-refresh the table. On window-focus we do a light peek; if the
  // server has MORE records than we're showing, a minimal toast offers a Reload.
  // Keeps backend/compute use low while still flagging fresh bookings.
  // The peek is throttled to at most one per minute so repeatedly clicking back
  // into the tab can't fire a flood of API calls (which hung the page before).
  const [newCount, setNewCount] = useState(0);
  const knownCountRef = useRef(0);
  const lastPeekAtRef = useRef(0);
  const FOCUS_PEEK_THROTTLE_MS = 60 * 1000;

  useEffect(() => {
    knownCountRef.current = allRecords?.length ?? knownCountRef.current;
  }, [allRecords]);

  useEffect(() => {
    function peek() {
      const now = Date.now();
      if (now - lastPeekAtRef.current < FOCUS_PEEK_THROTTLE_MS) return;
      lastPeekAtRef.current = now;
      getAllAppointments({ role, id, userEmail }).then((res) => {
        if (!res?.success) return;
        const diff = (res.data ?? []).length - knownCountRef.current;
        if (diff > 0) setNewCount(diff);
      });
    }
    window.addEventListener("focus", peek);
    return () => window.removeEventListener("focus", peek);
  }, [role, id, userEmail]);

  const handleReload = useCallback(() => {
    refetch();
    setNewCount(0);
  }, [refetch]);

  // Sound-on-new-enquiry, with a persisted mute toggle. Read the stored pref on
  // mount (not during render) so server and first client render agree - reading
  // localStorage in the initializer would trip a hydration mismatch.
  const [soundMuted, setSoundMuted] = useState(false);
  useEffect(() => setSoundMuted(isEnquirySoundMuted()), []);

  const toggleSound = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      setEnquirySoundMuted(next);
      // Unmuting is a click - a user gesture - so it both confirms audibly and
      // primes the AudioContext, making the later focus-triggered beeps land.
      if (!next) playEnquiryBeep();
      return next;
    });
  }, []);

  // Surface the new-enquiry count as a colored, top-right toast (see the root
  // <Toaster position="top-right" richColors /> in layout.tsx). A stable id
  // means repeat focus-peeks UPDATE this one toast instead of stacking copies.
  useEffect(() => {
    if (newCount <= 0) return;
    playEnquiryBeep(); // no-ops when muted or audio is blocked
    toast.info(`${newCount} new ${newCount === 1 ? "enquiry" : "enquiries"}`, {
      id: "new-enquiries",
      description: "The server has newer records than shown here.",
      duration: 10000,
      action: { label: "Reload", onClick: handleReload },
    });
  }, [newCount, handleReload]);

  // Frontend-side scoping: surface records that participate in the enquiry funnel.
  // A record counts as "enquiry-funnel" if its status is "enquiry" OR it has
  // any funnel field populated. Keeps the page free of pure legacy appointment
  // records while still showing every new record the executive logs.
  const enquiryRecords = useMemo<EnquiryType[]>(() => {
    if (!allRecords) return [];
    return allRecords.filter((r: EnquiryType) => {
      const isEnquiryFunnel =
        r.status === "enquiry" ||
        r.preferredReachOutTime !== undefined ||
        r.executiveReachedOut === true ||
        r.consultationSlot !== undefined ||
        r.physioSlot !== undefined;
      return isEnquiryFunnel;
    });
  }, [allRecords]);

  // Partition by whether the lead has been touched in ANY way.
  // Untouched ("Needs first contact" - top section): default-state enquiries
  //   that nobody has acted on yet. Status is still "enquiry" AND no executive
  //   has marked reach-out. As soon as ANY action happens (reach-out tick,
  //   slot booked, status manually changed to cancelled/scheduled/etc.),
  //   the lead moves to "Attended".
  // Attended (bottom section): everything else - including leads cancelled
  //   without ever being contacted (executive looked, decided nothing more
  //   to do, set status=cancelled).
  const unattendedRecords = useMemo(
    () =>
      enquiryRecords.filter(
        (r) =>
          (r.status ?? "enquiry") === "enquiry" &&
          r.executiveReachedOut !== true &&
          // Leads we've already tried but couldn't reach move to /dashboard/follow-ups,
          // so "Needs first contact" stays genuinely untouched.
          (r.reachAttempts ?? 0) === 0,
      ),
    [enquiryRecords],
  );

  const attendedRecords = useMemo(
    () =>
      enquiryRecords.filter(
        (r) =>
          (r.status ?? "enquiry") !== "enquiry" ||
          r.executiveReachedOut === true,
      ),
    [enquiryRecords],
  );

  // Show most-recently-created first in the bottom section.
  // EnquiryType doesn't declare createdAt (it's a Mongoose-side timestamp),
  // so we cast through `unknown` to read it.
  const sortedAttended = useMemo(() => {
    return [...attendedRecords].sort((a, b) => {
      const aDate = readTimestamp(a, "createdAt");
      const bDate = readTimestamp(b, "createdAt");
      return bDate - aDate;
    });
  }, [attendedRecords]);

  // Per-stage counts within attended only - used by the stage filter dropdown.
  // Seeded from STAGE_ORDER so adding a stage can't leave a hole here.
  const attendedStageCounts = useMemo(() => {
    const counts = Object.fromEntries(
      STAGE_ORDER.map((s) => [s, 0]),
    ) as Record<FunnelStage, number>;
    for (const r of attendedRecords) counts[deriveStage(r)]++;
    return counts;
  }, [attendedRecords]);

  // Narrow attended list by the chosen stage filter.
  const filteredAttended = useMemo(() => {
    if (attendedStageFilter === "all") return sortedAttended;
    return sortedAttended.filter((r) => deriveStage(r) === attendedStageFilter);
  }, [sortedAttended, attendedStageFilter]);

  const displayedAttended = bottomExpanded
    ? filteredAttended
    : filteredAttended.slice(0, COLLAPSED_ATTENDED_ROWS);

  // Untouched leads: the timestamp = when the enquiry arrived → "Waiting since".
  const topColumns = useMemo(
    () =>
      makeEnquiryColumns({
        onOpenDetail: (r) => setOpenDetail(r),
        lastActiveLabel: "Waiting since",
        lastActiveField: "received",
        showReferral: isSuperAdmin,
      }),
    [isSuperAdmin],
  );
  // Attended leads: the timestamp = last staff action → "Last updated".
  const bottomColumns = useMemo(
    () =>
      makeEnquiryColumns({
        onOpenDetail: (r) => setOpenDetail(r),
        lastActiveLabel: "Last updated",
        lastActiveField: "updated",
        showReferral: isSuperAdmin,
      }),
    [isSuperAdmin],
  );

  // Top-section empty message changes based on whether ANY records exist.
  // "All caught up" only fires when there ARE records but none are untouched.
  const topEmptyMessage =
    enquiryRecords.length === 0
      ? "No enquiries yet. Click + New Enquiry to log one."
      : "All caught up - every lead has been contacted.";

  const enquiryTodayStats = useMemo(
    () => ({
      newToday: enquiryRecords.filter((r) => isTodayISO(readCreatedISO(r)))
        .length,
      reachedToday: enquiryRecords.filter((r) =>
        isTodayISO(r.executiveReachedOutAt),
      ).length,
      attemptsToday: enquiryRecords.filter((r) => isTodayISO(r.lastAttemptAt))
        .length,
    }),
    [enquiryRecords],
  );

  return (
    <>
      <MetricCardsRow className="mb-4">
        <MetricCard
          label="New enquiries today"
          value={enquiryTodayStats.newToday}
        />
        <MetricCard
          label="Reached out today"
          value={enquiryTodayStats.reachedToday}
        />
        <MetricCard
          label="Call attempts today"
          value={enquiryTodayStats.attemptsToday}
        />
      </MetricCardsRow>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
          <div>
            <CardTitle>Enquiries</CardTitle>
            <CardDescription>
              Track inbound leads from first call to physiotherapist assignment.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleSound}
              aria-pressed={soundMuted}
              title={
                soundMuted
                  ? "New-enquiry sound is off - click to turn on"
                  : "New-enquiry sound is on - click to mute"
              }
              aria-label={
                soundMuted ? "Turn new-enquiry sound on" : "Mute new-enquiry sound"
              }
            >
              {soundMuted ? (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <RefreshButton
              onClick={handleReload}
              isFetching={isFetching}
              label="Refresh enquiries"
            />
            <EnquiryIntakeModal />
          </div>
        </CardHeader>

        <CardContent>
          <QueryWrapper
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={refetch}
            skeleton={<EnquiriesTableSkeleton />}
          >
            {/* ── TOP SECTION: Needs first contact ── */}
            <section className="mb-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold flex items-baseline gap-2">
                  Needs first contact
                  <span className="text-sm font-normal text-muted-foreground">
                    ({unattendedRecords.length})
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Leads no one has reached out to yet - call them and tick
                  &ldquo;Mark as reached out&rdquo; in their drawer.
                </p>
              </div>
              <SectionTable
                records={unattendedRecords}
                columns={topColumns}
                search={topSearch}
                onSearchChange={setTopSearch}
                searchPlaceholder="Search untouched leads..."
                emptyMessage={topEmptyMessage}
                paginated={false}
                onRowClick={setOpenDetail}
                rowClassName={(r) =>
                  isStaleUntouched(r) ? STALE_ROW_CLASS : ""
                }
                // Hide funnel-checkpoint columns that are always empty for
                // untouched leads. Keeps the "call list" tight: just ID,
                // Name, Phone, Preferred, Status, Last active.
                hiddenColumnIds={[
                  "reach",
                  "bookingType",
                  "fee",
                  "paid",
                  "physioTherapist",
                  "visitSlot",
                  "reachedOutBy",
                ]}
              />
            </section>

            {/* ── BOTTOM SECTION: Attended ── */}
            <section className="mt-8 border-t pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <h2 className="text-lg font-semibold flex items-baseline gap-2 whitespace-nowrap">
                    Attended
                    <span className="text-sm font-normal text-muted-foreground">
                      ({attendedRecords.length})
                    </span>
                  </h2>
                  <Input
                    placeholder="Search attended leads..."
                    value={bottomSearch}
                    onChange={(e) => setBottomSearch(e.target.value)}
                    className="max-w-[200px] h-8 text-xs"
                  />
                  {bottomSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setBottomSearch("")}
                    >
                      Clear
                    </Button>
                  )}
                  <Select
                    value={attendedStageFilter}
                    onValueChange={(v) =>
                      setAttendedStageFilter(v as FunnelStage | "all")
                    }
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All stages ({attendedRecords.length})
                      </SelectItem>
                      {STAGE_ORDER.filter(
                        (s) => s !== "enquiry" && s !== "follow_up",
                      ).map((stage) => (
                        <SelectItem
                          key={stage}
                          value={stage}
                          disabled={attendedStageCounts[stage] === 0}
                        >
                          {STAGE_LABELS[stage]} ({attendedStageCounts[stage]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {attendedStageFilter !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setAttendedStageFilter("all")}
                    >
                      Clear filter
                    </Button>
                  )}
                </div>
                {attendedRecords.length > COLLAPSED_ATTENDED_ROWS && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBottomExpanded((v) => !v)}
                  >
                    {bottomExpanded
                      ? `Collapse to ${COLLAPSED_ATTENDED_ROWS}`
                      : `Show all (${attendedRecords.length})`}
                  </Button>
                )}
              </div>

              <SectionTable
                records={displayedAttended}
                columns={bottomColumns}
                search={bottomSearch}
                onSearchChange={setBottomSearch}
                searchPlaceholder="Search attended leads..."
                emptyMessage={
                  attendedStageFilter !== "all"
                    ? `No attended leads in stage "${STAGE_LABELS[attendedStageFilter]}".`
                    : "No leads contacted yet."
                }
                paginated={bottomExpanded}
                onRowClick={setOpenDetail}
                rowClassName={(r) =>
                  isStaleAttended(r) ? STALE_ROW_CLASS : ""
                }
                hideSearch
              />
              {!bottomExpanded &&
                filteredAttended.length > COLLAPSED_ATTENDED_ROWS && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {COLLAPSED_ATTENDED_ROWS} most recent of{" "}
                    {filteredAttended.length}. Click &ldquo;Show all&rdquo; to
                    see history with pagination.
                  </p>
                )}
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-200 border-l-4 border-l-amber-500" />
                Rows highlighted amber haven&apos;t been touched in 48+ hours
                (untouched section: 24+ hours) - likely need a follow-up.
              </p>
            </section>
          </QueryWrapper>
        </CardContent>
      </Card>

      <EnquiryDetailDrawer
        // The live record (not the row-click snapshot), so saves and payments
        // show in the open drawer immediately.
        record={openDetail ? (allRecords?.find((r) => r._id === openDetail._id) ?? openDetail) : null}
        onClose={() => setOpenDetail(null)}
      />
    </>
  );
}
