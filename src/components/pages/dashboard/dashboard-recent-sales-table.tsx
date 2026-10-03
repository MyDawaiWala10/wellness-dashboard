"use client";
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useGetAllAppointments } from "@/data/appointment/appointment";
import { useAuthStore } from "@/providers/permission-provider";
import { QueryWrapper } from "@/components/query-wrapper";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { readCreatedISO } from "@/lib/metrics";

const ITEMS_PER_PAGE = 10;

function AppointmentTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: 8 }).map((_, j) => (
            <div key={j} className="h-8 flex-1 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

const DashboardTable = () => {
  const { user } = useAuthStore();
  const { role, id, userEmail } = user || {};
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: appointmentData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllAppointments({ role, id, userEmail });

  // "Recent" - newest bookings first.
  const sorted = React.useMemo(() => {
    const list = appointmentData ?? [];
    return [...list].sort(
      (a, b) =>
        new Date(readCreatedISO(b) ?? 0).getTime() -
        new Date(readCreatedISO(a) ?? 0).getTime(),
    );
  }, [appointmentData]);

  const totalAppointments = sorted.length;
  const totalPages = Math.ceil(totalAppointments / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAppointments = sorted.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  return (
    <div className="w-full space-y-6">

      {/* appointments table */}
      <QueryWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        skeleton={<AppointmentTableSkeleton />}
      >
        <Card className="w-full border border-border shadow-sm bg-transparent">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-lg">Recent Appointments</CardTitle>
            <CardDescription className="text-sm">
              Tracking upcoming and past appointments
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            {totalAppointments > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Mobile No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((appt) => (
                      <TableRow key={appt._id}>
                        <TableCell>
                          <BookingIdBadge record={appt} />
                        </TableCell>
                        <TableCell>{appt.doctor}</TableCell>
                        <TableCell>{appt.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{appt.email}</TableCell>
                        <TableCell className="text-xs">{appt.phonenumber}</TableCell>
                        <TableCell>
                          {appt.slot?.date
                            ? new Date(appt.slot.date).toLocaleDateString("en-GB")
                            : "--"}
                        </TableCell>
                        <TableCell>{appt.slot?.time ?? "--"}</TableCell>
                        <TableCell>
                          <AppointmentStatusBadge status={appt.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No appointments found
              </div>
            )}

            {totalPages > 1 && (
              <Pagination className="mt-4 w-full">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        onClick={() => setCurrentPage(i + 1)}
                        isActive={currentPage === i + 1}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </CardContent>
        </Card>
      </QueryWrapper>
    </div>
  );
};

export default DashboardTable;