"use client";
import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DoctorsDataTable } from "./Doctorsdatatable";
import AddDoctorForm from "./adddoctorform";
import { TherapistDetailDrawer } from "./therapist-detail-drawer";
import { TherapistCalendarView } from "./therapist-calendar-view";
import { QueryWrapper } from "@/components/query-wrapper";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import { useGetTherapistSessionCounts } from "@/data/appointment/appointment";
import { TherapistformType } from "@/type/schema";
import { Button } from "@/components/ui/button";
import { CalendarDays, Table2 } from "lucide-react";
import { useAuthStore } from "@/providers/permission-provider";
import { getDoctorsListColumns } from "./doctorslisttable";

interface ColumnDataType<TData extends TherapistformType> {
  columns?: ColumnDef<TData>[];
}

export default function AllTherapistPage({
  columns,
}: ColumnDataType<TherapistformType>) {
  const { data: DoctorsDetail, isLoading, isError, error, refetch } = useGetAllTherapist();
  const { data: sessionCounts = [] } = useGetTherapistSessionCounts();
  const [selected, setSelected] = useState<TherapistformType | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const { user } = useAuthStore();
  const isTherapist = user?.role === "THERAPIST";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Generate columns with session counts
  const tableColumns = useMemo(
    () => getDoctorsListColumns(sessionCounts),
    [sessionCounts]
  );

  // For THERAPIST role, filter to only their own record
  const displayData = isTherapist
    ? (DoctorsDetail ?? []).filter(
        (d: TherapistformType) =>
          d.userId === user?.id || d.email === user?.userEmail,
      )
    : (DoctorsDetail ?? []);

  const pageTitle = isTherapist ? "My Profile" : "Therapist List";
  const pageDescription = isTherapist
    ? "View and manage your profile."
    : "Manage all your Therapist.";

  return (
    <QueryWrapper isLoading={isLoading} isError={isError} error={error} onRetry={refetch}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap justify-start items-center gap-2">
          <div className="flex flex-col gap-2">
            <CardTitle>{pageTitle}</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "table" ? "calendar" : "table")}
              className="flex items-center gap-1"
            >
              {viewMode === "table" ? (
                <>
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </>
              ) : (
                <>
                  <Table2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Table</span>
                </>
              )}
            </Button>
            {!isTherapist && <AddDoctorForm />}
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "table" ? (
            <DoctorsDataTable
              columns={tableColumns}
              data={displayData}
              onRowClick={(row) => setSelected(row)}
            />
          ) : (
            <TherapistCalendarView
              onBack={() => setViewMode("table")}
              filterDoctorId={isTherapist ? displayData[0]?.doctorId : undefined}
            />
          )}
        </CardContent>
      </Card>

      <TherapistDetailDrawer
        therapist={selected}
        onClose={() => setSelected(null)}
        hideDelete={!isSuperAdmin}
        hideStatus={isTherapist}
      />
    </QueryWrapper>
  );
}
