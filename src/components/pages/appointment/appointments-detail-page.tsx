// Appointment detail - right-side drawer (controlled by the table's row click).
"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { slotBookingZodType } from "@/type/schema";
import AppointmentDetailsPage from "./appointments-details-page";
import { AppointmentSummaryStrip } from "./appointment-summary-strip";
import { VisitTab } from "./visit-tab";
import { BillingTab } from "./billing-tab";
import { HistoryTab } from "./history-tab";
import { SessionsTab } from "./sessions-tab";
import { childVisitsOf } from "@/lib/visit-groups";
import { RecordIds } from "./record-ids";
import { BookingSourceEditor } from "@/components/booking-source-editor";
import { useGetServices } from "@/data/service/service";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import { getPackageProgressForAppointment } from "@/lib/package-progress";
import { bookingLedger } from "@/lib/booking-money";

type AppointmentDetailDrawerProps = {
  data: slotBookingZodType | null;
  allAppointments: slotBookingZodType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Two people share this panel: a therapist standing in someone's home, and an
 * executive chasing a payment. It used to stack both jobs into one long scroll -
 * six boxes deep, with the therapist's work at the very bottom.
 *
 * Now a summary strip answers who / how much / how far along without a click,
 * and each role gets its own tab.
 */
const AppointmentDetailDrawer = ({
  data,
  allAppointments,
  open,
  onOpenChange,
}: AppointmentDetailDrawerProps) => {
  const { data: services = [] } = useGetServices();
  const { data: therapists = [] } = useGetAllTherapist();

  const live = useMemo(() => {
    if (!data?._id) return data;
    return allAppointments.find((a) => a._id === data._id) ?? data;
  }, [data, allAppointments]);

  const progress = live
    ? getPackageProgressForAppointment(live, allAppointments, services)
    : null;
  const due = live ? bookingLedger(live).due : 0;
  // Later visits that live inside this booking (add-on sessions, course follow-ups).
  const visits = live ? childVisitsOf(live, allAppointments) : [];
  const openVisits = visits.filter((v) => v.status !== "completed" && v.status !== "cancelled");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-0">
          <SheetTitle className="sr-only">
            {live?.name ?? "Appointment"}
          </SheetTitle>
        </SheetHeader>

        {live ? (
          <div className="space-y-3 px-4 pb-6">
            <AppointmentSummaryStrip appointment={live} services={services} />

            {/* A finished booking with visits still to come opens on them. */}
            <Tabs
              key={live._id}
              defaultValue={live.status === "completed" && openVisits.length > 0 ? "sessions" : "visit"}
            >
              <TabsList className="w-full">
                <TabsTrigger value="visit" className="flex-1">
                  Visit
                </TabsTrigger>
                {visits.length > 0 && (
                  <TabsTrigger value="sessions" className="flex-1">
                    Sessions
                    {openVisits.length > 0 && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{openVisits.length}</span>
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger value="money" className="flex-1">
                  Billing
                  {due > 0 && (
                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visit" className="mt-3">
                <VisitTab
                  appointment={live}
                  allAppointments={allAppointments}
                />
              </TabsContent>

              {visits.length > 0 && (
                <TabsContent value="sessions" className="mt-3">
                  <SessionsTab booking={live} allAppointments={allAppointments} />
                </TabsContent>
              )}

              <TabsContent value="money" className="mt-3">
                <BillingTab appointment={live} />
              </TabsContent>

              <TabsContent value="history" className="mt-3 space-y-4">
                <HistoryTab appointment={live} services={services} visits={visits} />
                <RecordIds
                  appointment={live}
                  therapistPhone={
                    live.doctorId
                      ? (
                          therapists as {
                            doctorId?: string;
                            phonenumber?: string;
                          }[]
                        ).find((t) => t.doctorId === live.doctorId)?.phonenumber
                      : undefined
                  }
                />
                <BookingSourceEditor key={live._id} record={live} />
                {/* Booking details and the customer record - rarely touched
                    mid-visit, so they sit behind the History tab. */}
                <AppointmentDetailsPage
                  data={live}
                  onClose={() => onOpenChange(false)}
                  compact={!!progress}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default AppointmentDetailDrawer;
