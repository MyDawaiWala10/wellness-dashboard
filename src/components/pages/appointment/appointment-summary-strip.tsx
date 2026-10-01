"use client";

import { MapPin, MessageCircle, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ServiceType, slotBookingZodType } from "@/type/schema";
import { getPackageProgressForAppointment } from "@/lib/package-progress";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import { bookingLedger } from "@/lib/booking-money";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { formatINR } from "@/components/pages/services/services-columns";
import { whatsAppLink, toWhatsAppNumber } from "@/lib/whatsapp";

/**
 * Who, how much, how far along - answered before anyone clicks anything.
 *
 * The panel serves a therapist standing in someone's home and an executive
 * chasing a payment; this strip is the one thing both need first, so it sits
 * above the tabs and never scrolls away.
 */
export function AppointmentSummaryStrip({
  appointment,
  services,
}: {
  appointment: slotBookingZodType;
  services: ServiceType[];
}) {
  const progress = getPackageProgressForAppointment(
    appointment,
    [appointment],
    services,
  );
  const { due } = bookingLedger(appointment);
  const wa = whatsAppLink(appointment.phonenumber, "");
  const dialable = toWhatsAppNumber(appointment.phonenumber);
  const pct = progress
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const mapsQuery = appointment.location || appointment.name;
  const mapsUrl = mapsQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}&travelmode=two_wheeler&dir_action=navigate`
    : null;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight">
            {appointment.name || "Unnamed"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {appointment.phonenumber ?? "no number"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={appointment.location ? `Get directions to: ${appointment.location}` : "Get directions on Google Maps"}
              aria-label="Get directions on Google Maps"
              className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-4 w-4" />
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              aria-label="Message on WhatsApp"
              className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          {dialable && (
            <a
              href={`tel:${dialable}`}
              title="Call"
              aria-label="Call the customer"
              className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground hover:text-foreground"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {appointment.enquiryId && <BookingIdBadge record={appointment} />}
        <Badge variant="secondary" className="text-[11px]">
          {bookingLabel(appointment)}
        </Badge>
        {due > 0 ? (
          <Badge
            variant="outline"
            className="border-amber-500 text-[11px] text-amber-700 dark:text-amber-400"
          >
            {formatINR(due)} due
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-emerald-600 text-[11px] text-emerald-700 dark:text-emerald-400"
          >
            Settled
          </Badge>
        )}
        {!appointment.doctorId && (
          <Badge
            variant="outline"
            className="border-red-500 text-[11px] text-red-600 dark:text-red-400"
          >
            No therapist
          </Badge>
        )}
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">
                Session {progress.currentSession}
              </span>{" "}
              of {progress.total}
            </span>
            <span>{Math.max(progress.total - progress.completed, 0)} left</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
