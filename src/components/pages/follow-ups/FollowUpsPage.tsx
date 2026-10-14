"use client";

import { useMemo, useState } from "react";
import { RefreshButton } from "@/components/refresh-button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryWrapper } from "@/components/query-wrapper";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/providers/permission-provider";
import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import type { EnquiryType } from "@/type/schema";

import { SectionTable } from "../enquiries/EnquiriesPage";
import { makeEnquiryColumns } from "../enquiries/enquiries-columns";
import { EnquiryDetailDrawer } from "../enquiries/enquiry-detail-drawer";
import { isFollowUp } from "../enquiries/stage";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";
import { isTodayISO } from "@/lib/metrics";

// Columns that don't apply to a not-yet-connected lead are hidden here.
// (Stage is always "Follow-up" on this page, and the ENQ id is redundant.)
const HIDDEN_COLUMN_IDS = [
  "enquiryId",
  "status",
  "reach",
  "bookingType",
  "fee",
  "paid",
  "physioTherapist",
  "visitSlot",
];

// A follow-up is "going cold" if we haven't tried it again in over a day.
const COLD_AFTER_MS = 24 * 60 * 60 * 1000;
const COLD_ROW_CLASS =
  "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-500";

function readTimestamp(r: EnquiryType, key: "createdAt"): number {
  const v = (r as unknown as Record<string, string | undefined>)[key];
  const t = v ? new Date(v).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function isCold(r: EnquiryType): boolean {
  const iso = r.lastAttemptAt;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > COLD_AFTER_MS;
}

export default function FollowUpsPage() {
  const { user } = useAuthStore();
  const { id, role, userEmail } = user || {};
  const { data: allRecords, isLoading, isLoadingError: isError, error, refetch, isFetching } =
    useGetAllEnquiries({ role, id, userEmail });

  const [openDetail, setOpenDetail] = useState<EnquiryType | null>(null);
  const [search, setSearch] = useState("");

  // Leads we've tried but not yet connected with. Default order: longest-waiting
  // first ("Waiting since", oldest first). Columns are sortable, so executives
  // can re-sort by call tries or preferred call time as they work the list.
  const followUps = useMemo(() => {
    const list = (allRecords ?? []).filter(isFollowUp);
    return [...list].sort(
      (a, b) => readTimestamp(a, "createdAt") - readTimestamp(b, "createdAt"),
    );
  }, [allRecords]);

  const columns = useMemo(
    () =>
      makeEnquiryColumns({
        onOpenDetail: (r) => setOpenDetail(r),
        lastActiveLabel: "Waiting since",
        lastActiveField: "received",
        showAttempts: true,
        showContactCols: true,
      }),
    [],
  );

  const todayStats = useMemo(() => {
    const recs = allRecords ?? [];
    return {
      newToday: recs.filter(
        (r) => r.reachAttempts === 1 && isTodayISO(r.lastAttemptAt),
      ).length,
      attemptsToday: recs.filter((r) => isTodayISO(r.lastAttemptAt)).length,
      connectedToday: recs.filter(
        (r) => (r.reachAttempts ?? 0) > 0 && isTodayISO(r.executiveReachedOutAt),
      ).length,
    };
  }, [allRecords]);

  return (
    <>
      <MetricCardsRow className="mb-4">
        <MetricCard label="New follow-ups today" value={todayStats.newToday} />
        <MetricCard label="Attempts made today" value={todayStats.attemptsToday} />
        <MetricCard
          label="Connected today"
          value={todayStats.connectedToday}
          hint="Chased & finally reached"
        />
        <MetricCard label="Open follow-ups" value={followUps.length} />
      </MetricCardsRow>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
          <div>
            <CardTitle>Follow-ups</CardTitle>
            <CardDescription>
              Leads we&apos;ve tried to reach but couldn&apos;t connect with yet -
              call them back and tick &ldquo;Mark as reached out&rdquo; once you
              get through.
            </CardDescription>
          </div>
          <RefreshButton
            onClick={() => refetch()}
            isFetching={isFetching}
            label="Refresh follow-ups"
          />
        </CardHeader>
        <CardContent>
          <QueryWrapper isLoading={isLoading} isError={isError} error={error}>
            <SectionTable
              records={followUps}
              columns={columns}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search follow-ups..."
              emptyMessage="No follow-ups - every attempted lead has been reached."
              paginated
              onRowClick={setOpenDetail}
              hiddenColumnIds={HIDDEN_COLUMN_IDS}
              rowClassName={(r) => (isCold(r) ? COLD_ROW_CLASS : "")}
            />
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-200 border-l-4 border-l-amber-500" />
              Rows highlighted amber haven&apos;t been tried again in 24+ hours.
            </p>
          </QueryWrapper>
        </CardContent>
      </Card>

      <EnquiryDetailDrawer
        record={openDetail}
        onClose={() => setOpenDetail(null)}
      />
    </>
  );
}
