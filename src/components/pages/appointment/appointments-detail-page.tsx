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

            <Tabs defaultValue="visit">
              <TabsList className="w-full">
                <TabsTrigger value="visit" className="flex-1">
                  Visit
                </TabsTrigger>
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

              <TabsContent value="money" className="mt-3">
                <BillingTab appointment={live} />
              </TabsContent>

              <TabsContent value="history" className="mt-3 space-y-4">
                <HistoryTab appointment={live} services={services} />
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
