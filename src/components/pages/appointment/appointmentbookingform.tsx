"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  CirclePlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { slotBookingZodSchema } from "@/type/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBookAppointment, useGetAllAppointments } from "@/data/appointment/appointment";
import { useGetAllEnquiries } from "@/data/enquiry/enquiry";
import {
  BOOKING_TYPES,
  bookingKindOf,
  bookingLabel,
  catalogueFee,
  type BookingType,
} from "@/components/pages/enquiries/booking";
import { TherapistAvailabilityGrid } from "@/components/pages/enquiries/therapist-availability-grid";
import { BookingSourceField } from "@/components/booking-source-field";
import { bookingSourceError, type BookingSource } from "@/lib/booking-source";
import { useGetServices } from "@/data/service/service";
import { useGetClinicSettings } from "@/data/clinic-settings/clinic-settings";
import { CustomerSearchField } from "@/components/pages/invoices/customer-search-field";
import { sessionRate, sessionTotal, addonPrice, recommendedAddonTotal } from "@/lib/service-pricing";
import {
  checkConflict,
  toMinutes,
  type ConflictResult,
} from "@/lib/booking-conflicts";
import { useGetSessionRates } from "@/data/session-rate/session-rate";
import { useAuthStore } from "@/providers/permission-provider";
import { formatINR } from "@/components/pages/services/services-columns";
import { useQueryClient } from "@tanstack/react-query";
import addAppointments from "@/actions/appointments/book-appointment";
import createPaymentLink from "@/actions/appointments/create-payment-link";
import { whatsAppLink, toWhatsAppNumber } from "@/lib/whatsapp";
import { publicOrigin } from "@/lib/brand";
import {
  paymentRequestMessage,
  paymentConfirmedMessage,
} from "@/lib/payment-messages";

type StackedService = { serviceId: string; discount: boolean; sessions?: number };

export default function AppointmentBookingForm() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // Session-only by default; flip on to attach (stack) services.
  const [attachServices, setAttachServices] = useState(false);
  const [stacked, setStacked] = useState<StackedService[]>([]);
  // Visit length that drives the therapy span (therapyStartTime/EndTime) and
  // the conflict check below - same control + default as the enquiry side.
  const [durationMin, setDurationMin] = useState(60);
  // A too-close candidate is staged here (with its already-built payload)
  // until the exec confirms the soft-warn dialog.
  const [pendingTooClose, setPendingTooClose] = useState<{
    payload: z.infer<typeof slotBookingZodSchema>;
    conflict: ConflictResult;
  } | null>(null);

  const mutation = useBookAppointment();
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);
  const { data: services = [], isLoading: servicesLoading } = useGetServices();
  const { data: rateCard } = useGetSessionRates();

  // Appointments (reused from the list) power the per-therapist day load AND
  // the pre-submit conflict check in onSubmit below.
  const authUser = useAuthStore((s) => s.user);
  const { data: appointments = [] } = useGetAllAppointments({
    id: authUser?.id,
    role: authUser?.role,
    userEmail: authUser?.userEmail,
  });
  // Enquiry-stage records too: the appointments query filters out status
  // "enquiry", and an intake sold through "Request payment on WhatsApp" is saved
  // exactly that way - so without these, its customer would look like they had
  // never had a consultation.
  const { data: enquiries = [], isLoading: enquiriesLoading } =
    useGetAllEnquiries({
      id: authUser?.id,
      role: authUser?.role,
      userEmail: authUser?.userEmail,
    });
  const { data: clinicSettings } = useGetClinicSettings();
  const gapMinutes = clinicSettings?.bookingGapMinutes ?? 60;

  // Reason the consultation is being skipped (fast-track customers only).
  const [skipReason, setSkipReason] = useState("");

  const form = useForm<z.infer<typeof slotBookingZodSchema>>({
    resolver: zodResolver(slotBookingZodSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      location: "",
      service: "",
      customer_id: "",
      sessionNumber: undefined,
      quotedPrice: undefined,
      originalPrice: undefined,
      discountAmount: undefined,
      discountType: undefined,
      discountCode: undefined,
      // Intake is the front door: a first-time customer starts here.
      bookingKind: "intake",
      typeOfappointment: "appointment",
      slot: {
        date: format(new Date(), "yyyy-MM-dd"),
        time: "",
      },
      note: "",
      age: undefined,
      phonenumber: undefined,
      email: "",
      doctor: "",
      therapyEndTime: "",
      therapyStartTime: "",
      doctorId: "",
      status: "scheduled",
      // No default on purpose: an untouched pick would file a walk-in as WhatsApp.
      source: "",
      referredByDoctorId: null,
    },
  });

  const selectedDate = form.watch("slot.date");
  const sessions = form.watch("sessionNumber");
  const quotedPrice = form.watch("quotedPrice");
  const doctorId = form.watch("doctorId");
  const customerId = form.watch("customer_id");

  const tiers = rateCard?.tiers ?? [];
  const noTier = (sessions ?? 0) > 0 && sessionRate(tiers, sessions ?? 0) === 0;

  // ── Intake vs course ──────────────────────────────────────────────────────
  // An intake is the one-off diagnostic front door (online consultation or home
  // visit), priced from the services catalogue. A course is the treatment block
  // bought afterwards: always delivered at home, priced from the rate table.
  const bookingKind = form.watch("bookingKind") ?? "intake";
  const isCourse = bookingKind === "course";
  const deliveryType = (form.watch("typeOfappointment") ?? "appointment") as BookingType;
  const intakeFee = isCourse ? undefined : catalogueFee(deliveryType, services);

  // The price this booking should carry, derived during render. A course prices
  // from the rate table, an intake from the services catalogue.
  const autoPrice = isCourse
    ? sessionTotal(tiers, sessions ?? 0) || undefined
    : intakeFee;

  // Apply it as an effect, not just in the session field's onChange: a count
  // typed before the rate card resolves would otherwise stay unpriced.
  //
  // Depends on the PRICE, never on `tiers` - that is `rateCard?.tiers ?? []`,
  // a fresh array identity every render, which made this effect re-run, setValue,
  // re-render, and loop until React bailed out. A primitive dep also means a
  // hand-typed price survives, since it doesn't change what this computes.
  // No shouldValidate - that would paint an error the moment the modal opens.
  useEffect(() => {
    form.setValue("quotedPrice", autoPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrice]);

  // Has this customer ever been through an intake? Matched on customer_id when
  // one is linked, else on phone. Cancelled records don't count as a consultation.
  const phone = form.watch("phonenumber");
  const historyLoading = enquiriesLoading;
  const hasPriorIntake = useMemo(() => {
    if (!customerId && !phone) return false;
    const seen = [...appointments, ...enquiries];
    return seen.some(
      (r) =>
        r.status !== "cancelled" &&
        (customerId ? r.customer_id === customerId : r.phonenumber === phone) &&
        bookingKindOf(r) === "intake",
    );
  }, [appointments, enquiries, customerId, phone]);

  // Fast-track: booking a course for someone with no consultation on record.
  // Held back while history loads, so the prompt can't flash on open.
  const identified = !!customerId || !!phone;
  const needsSkipReason =
    isCourse && identified && !historyLoading && !hasPriorIntake;

  // Priced stacked services + running totals for the breakdown.
  const stackedPriced = stacked.map((row) => {
    const svc = services.find((s) => s.serviceId === row.serviceId);
    const { perSession, total, usesTiers } = recommendedAddonTotal(
      tiers,
      row.sessions,
      svc,
      row.discount,
    );
    return { ...row, svc, unitPrice: perSession, price: total, usesTiers };
  });
  const servicesTotal = stackedPriced.reduce((sum, r) => sum + r.price, 0);
  const grandTotal = (quotedPrice ?? 0) + servicesTotal;

  // Human label for the payment memos, from the shared helper so a course is
  // never labelled with an intake type (e.g. "Therapy course (6 sessions)").
  const itemLabel = bookingLabel({
    bookingKind,
    totalSessions: isCourse ? sessions : undefined,
    typeOfappointment: deliveryType,
  });

  // Everything that makes a booking unsaveable, in one place - both save paths
  // (Confirm, and "Request payment on WhatsApp") run it. An unpriced record
  // generates no invoice at all, so a missing price is a hard stop, not a nag.
  function blockingReason(
    v: z.infer<typeof slotBookingZodSchema>,
  ): string | null {
    if (!v.name?.trim()) return "Enter the customer name";
    const sourceProblem = bookingSourceError({
      source: (v.source ?? "") as BookingSource | "",
      referredByDoctorId: v.referredByDoctorId,
    });
    if (sourceProblem) return sourceProblem;
    if (isCourse && !(v.sessionNumber && v.sessionNumber >= 1)) {
      return "Enter how many sessions this course is";
    }
    if (!(v.quotedPrice && v.quotedPrice > 0)) {
      return isCourse
        ? "No price yet - set a rate tier for this session count, or type the price"
        : "No price yet - add this service to the Services page, or type the price";
    }
    // Discount validation: discount cannot exceed original price
    if (v.discountAmount && v.discountAmount > 0) {
      const effectiveOriginal = v.originalPrice ?? v.quotedPrice ?? 0;
      if (v.discountType === "percent" && v.discountAmount > 100) {
        return "Discount percentage cannot exceed 100%";
      }
      if (v.discountType === "fixed" && v.discountAmount > effectiveOriginal) {
        return "Discount amount cannot exceed the original price";
      }
    }
    if (needsSkipReason && !skipReason.trim()) {
      return "Give a reason for skipping the consultation";
    }
    return null;
  }

  // The fast-track reason belongs in the audit trail, not in `note` - the
  // clinical note is snapshotted and cleared on every session completion, so a
  // reason stored there would vanish with session 1.
  function skipReasonLog() {
    if (!needsSkipReason || !skipReason.trim()) return [];
    return [
      {
        at: new Date().toISOString(),
        userId: authUser?.id,
        name:
          `${authUser?.userfName ?? ""} ${authUser?.userlName ?? ""}`.trim() ||
          authUser?.userEmail ||
          "Someone",
        action: `Booked without a consultation - reason: ${skipReason.trim()}`,
      },
    ];
  }

  const toggleAttach = (on: boolean) => {
    setAttachServices(on);
    if (!on) setStacked([]);
    else if (stacked.length === 0) setStacked([{ serviceId: "", discount: false }]);
  };
  const addStacked = () =>
    setStacked((s) => [...s, { serviceId: "", discount: false, sessions: undefined }]);
  const removeStacked = (i: number) =>
    setStacked((s) => s.filter((_, idx) => idx !== i));
  const patchStacked = (i: number, patch: Partial<StackedService>) =>
    setStacked((s) => s.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Builds the final payload: stacked services (if any) + the therapy span
  // computed from the picked start time + durationMin, zero-padded exactly
  // like enquiry-detail-drawer.tsx's confirmAssignment.
  function buildPayload(
    values: z.infer<typeof slotBookingZodSchema>,
  ): z.infer<typeof slotBookingZodSchema> {
    const payload = { ...values };
    // Stable total for per-session tracking (the completion flow repurposes
    // sessionNumber as a moving pointer, so snapshot the count here). Only a
    // course has one - an intake is a single visit and must stay countless, or
    // bookingKindOf would read it back as a course.
    if (isCourse && values.sessionNumber && values.sessionNumber > 0) {
      payload.totalSessions = values.sessionNumber;
    } else if (!isCourse) {
      payload.sessionNumber = undefined;
      payload.totalSessions = undefined;
    }
    const skipLog = skipReasonLog();
    if (skipLog.length) {
      payload.activityLog = [...(values.activityLog ?? []), ...skipLog];
    }
    if (attachServices) {
      const now = new Date().toISOString();
      const paymentDone = !!values.paymentReceived;
      payload.recommendedServices = stacked
        .filter((r) => r.serviceId)
        .map((r) => {
          const svc = services.find((s) => s.serviceId === r.serviceId);
          const { total } = recommendedAddonTotal(
            tiers,
            r.sessions,
            svc,
            r.discount,
          );
          return {
            serviceId: r.serviceId,
            serviceName: svc?.name ?? "",
            quotedPrice: total,
            sessions: r.sessions && r.sessions > 1 ? r.sessions : undefined,
            status: "confirmed" as const,
            recommendedAt: now,
            paymentCollected: paymentDone,
          };
        });
    }

    const startMin = toMinutes(values.slot?.time ?? "");
    if (!Number.isNaN(startMin)) {
      const endMin = startMin + durationMin;
      payload.therapyStartTime = values.slot?.time;
      payload.therapyEndTime = `${String(Math.floor(endMin / 60)).padStart(
        2,
        "0",
      )}:${String(endMin % 60).padStart(2, "0")}`;
    }
    return payload;
  }

  // Remote pay: save the booking as a pending enquiry (unpaid, no therapist) so a
  // pay-link can be minted, then WhatsApp it - reusing the enquiry funnel's exact
  // link + message. The exec finishes it on Enquiries once the customer pays.
  async function requestPaymentWa() {
    const v = form.getValues();
    const amount = v.paymentAmount ?? v.quotedPrice ?? grandTotal;
    // This path bypasses the resolver entirely (it saves directly, as an
    // enquiry), so it needs the same gate as Confirm - otherwise it is exactly
    // where an unbillable record slips through.
    const blocked = blockingReason(v);
    if (blocked) {
      toast.error(blocked);
      return;
    }
    if (!toWhatsAppNumber(v.phonenumber)) {
      toast.error("Enter a valid phone number first");
      return;
    }
    setRequesting(true);
    const saved = await addAppointments({
      ...v,
      doctorId: "",
      doctor: "",
      status: "enquiry",
      paymentReceived: false,
      paymentAmount: amount,
      totalSessions: isCourse ? v.sessionNumber : undefined,
      activityLog: [...(v.activityLog ?? []), ...skipReasonLog()],
    });
    if (!saved.success || !saved.data?._id) {
      setRequesting(false);
      toast.error(saved.message ?? "Couldn't save the booking");
      return;
    }
    const link = await createPaymentLink(saved.data._id);
    setRequesting(false);
    if (!link.success || !link.data?.payToken) {
      toast.error(link.message ?? "Couldn't create the payment link");
      return;
    }
    const wa = whatsAppLink(
      v.phonenumber,
      paymentRequestMessage({
        name: v.name,
        bookingId: saved.data.enquiryId,
        item: itemLabel,
        amount,
        payUrl: `${publicOrigin()}/pay/${link.data.payToken}`,
      }),
    );
    if (wa) window.open(wa, "_blank", "noopener,noreferrer");
    for (const key of ["appointments", "enquiries", "customers"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
    toast.success("Payment request sent - finish it on Enquiries once paid.");
    handleDialogChange(false);
  }

  // Pay-now receipt: WhatsApp the customer that payment landed. Plain text (no
  // link), so it needs no saved record.
  function sendPaymentConfirmedWa() {
    const v = form.getValues();
    const visitLabel =
      v.doctor && v.slot?.time
        ? `${itemLabel}: ${v.slot?.date ?? ""} ${v.slot.time} with ${v.doctor}`
        : "";
    const wa = whatsAppLink(
      v.phonenumber,
      paymentConfirmedMessage({
        name: v.name,
        amount: v.paymentAmount ?? v.quotedPrice,
        method: v.paymentMethod,
        receivedAt: v.paymentReceivedAt ?? new Date().toISOString(),
        visitLabel,
      }),
    );
    if (!wa) {
      toast.error("Enter a valid phone number first");
      return;
    }
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  function submitBooking(payload: z.infer<typeof slotBookingZodSchema>) {
    mutation.mutate(payload, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        setAttachServices(false);
        setStacked([]);
        setDurationMin(60);
      },
    });
  }

  // Run the conflict check over the FULL candidate span, then gate the save:
  //   overlap   → blocked with a toast (never reaches the warn dialog),
  //   too-close → stage the payload and open the soft-warn dialog,
  //   ok        → submit straight through.
  // Mirrors enquiry-detail-drawer.tsx's attemptSave.
  function onSubmit(values: z.infer<typeof slotBookingZodSchema>) {
    // Branch rules live here, not in slotBookingZodSchema: that schema is shared
    // with the enquiry funnel and the drawer's edit form, where a missing price
    // is perfectly legitimate. Tightening it there would reject public enquiries.
    const blocked = blockingReason(values);
    if (blocked) {
      toast.error(blocked);
      return;
    }

    const conflict = checkConflict(
      {
        doctorId: values.doctorId ?? "",
        date: values.slot?.date ?? "",
        startTime: values.slot?.time ?? "",
        durationMin,
      },
      appointments,
      gapMinutes,
    );

    if (conflict.status === "overlap") {
      toast.error(
        `${durationMin} min from ${values.slot?.time} runs into ${conflict.with?.name}'s ${conflict.with?.time} visit - shorten it or pick another start.`,
      );
      return;
    }

    const payload = buildPayload(values);
    if (conflict.status === "too-close") {
      setPendingTooClose({ payload, conflict });
      return;
    }
    submitBooking(payload);
  }

  function handleDialogChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
      setAttachServices(false);
      setStacked([]);
      setDurationMin(60);
      setSkipReason("");
      setPendingTooClose(null);
    }
  }

  return (
    <>
    <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button className="flex justify-center items-center gap-1">
          <CirclePlus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Book Appointment
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="w-full max-w-6xl max-h-[92vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Book an Appointment</DialogTitle>
          <p className="text-sm text-muted-foreground">Pick a date, then a therapist - the list shows who&apos;s free that day.</p>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-5"
          >
            <div className="w-full space-y-5">
              {/* What is being sold decides everything below it: an intake is
                  one diagnostic visit priced from the catalogue; a course is N
                  home sessions priced from the rate table. */}
              <div className="space-y-2">
                <label className="text-sm font-medium">What are you booking?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      kind: "intake" as const,
                      title: "Consultation / Assessment",
                      hint: "First visit - diagnose what they need",
                    },
                    {
                      kind: "course" as const,
                      title: "Therapy sessions",
                      hint: "A course of home visits",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.kind}
                      type="button"
                      onClick={() => form.setValue("bookingKind", opt.kind)}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors",
                        bookingKind === opt.kind
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span className="block text-sm font-medium">{opt.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {opt.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery is an intake-only question - a course is always at home. */}
              {!isCourse && (
                <FormField
                  control={form.control}
                  name="typeOfappointment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How is it delivered?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pick one" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BOOKING_TYPES.map((b) => (
                            <SelectItem key={b.value} value={b.value}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* date first - drives the therapist load */}
              <FormField
                control={form.control}
                name="slot.date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Date</FormLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full sm:w-[240px] justify-start text-left font-normal")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                            setIsCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Therapist & time - the shared availability grid (rows =
                  therapists, columns = slots; includes the duration control and
                  specialization search). Locked until payment is marked, so a
                  therapist is never picked before the money is clear. */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Therapist &amp; time</label>
                {form.watch("paymentReceived") ? (
                  <TherapistAvailabilityGrid
                    date={selectedDate}
                    selectedDoctorId={doctorId}
                    selectedStart={form.watch("slot.time")}
                    durationMin={durationMin}
                    onDurationChange={setDurationMin}
                    onPick={({ doctorId, doctor, startTime }) => {
                      form.setValue("doctor", doctor);
                      form.setValue("doctorId", doctorId);
                      form.setValue("slot.time", startTime, {
                        shouldValidate: true,
                      });
                    }}
                  />
                ) : (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Mark the payment received (right) to choose a therapist and slot.
                  </p>
                )}
              </div>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Note..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="w-full space-y-4">
              <CustomerSearchField
                value={{
                  customer_name: form.watch("name") ?? "",
                  customer_phone: form.watch("phonenumber"),
                  email: form.watch("email") ?? "",
                  address: form.watch("location") ?? "",
                }}
                onChange={(sel) => {
                  form.setValue("name", sel.customer_name, {
                    shouldValidate: true,
                  });
                  form.setValue("customer_id", sel.customer_id ?? "");
                  // Only prefill the rest when an existing customer is picked,
                  // so typing a brand-new name never wipes entered details.
                  if (sel.customer_id) {
                    form.setValue("location", sel.address ?? "");
                    form.setValue("email", sel.email ?? "");
                    if (typeof sel.customer_phone === "number") {
                      form.setValue("phonenumber", sel.customer_phone, {
                        shouldValidate: true,
                      });
                    }
                  }
                }}
              />

              {/* Read-only IDs - auto-filled, not editable */}
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Therapist ID</span>
                  <span className="font-mono">{doctorId || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer ID</span>
                  <span className="font-mono">{customerId || "- (new customer)"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ID</span>
                  <span className="font-mono text-muted-foreground">assigned on save</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer location</FormLabel>
                    <FormControl><Input placeholder="Customer's location" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCourse && (
                <FormField
                  control={form.control}
                  name="sessionNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of sessions</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 6"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : e.target.valueAsNumber,
                            )
                          }
                        />
                      </FormControl>
                      {noTier && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          No rate tier covers {sessions} sessions - set one in Services → Session rates, or enter the price manually.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Session frequency: how often follow-up sessions occur */}
              {isCourse && sessions && sessions > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session interval</label>
                  <Select
                    value={String(form.watch("sessionIntervalDays") ?? "")}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        form.setValue("sessionIntervalDays", undefined);
                      } else {
                        form.setValue("sessionIntervalDays", Number(v));
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="How often?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Weekly (every 7 days)</SelectItem>
                      <SelectItem value="14">Biweekly (every 14 days)</SelectItem>
                      <SelectItem value="3">Every 3 days</SelectItem>
                      <SelectItem value="30">Monthly (every 30 days)</SelectItem>
                      <SelectItem value="custom">Custom interval</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.watch("sessionIntervalDays") === undefined && (
                    <Input
                      type="number"
                      min={1}
                      placeholder="Custom interval in days"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        if (val && val > 0) form.setValue("sessionIntervalDays", val);
                      }}
                    />
                  )}
                  {/* Date preview */}
                  {form.watch("sessionIntervalDays") && selectedDate && (() => {
                    const interval = form.watch("sessionIntervalDays")!;
                    const dates = Array.from({ length: sessions }, (_, i) => {
                      const d = new Date(selectedDate);
                      d.setDate(d.getDate() + i * interval);
                      return d;
                    });
                    return (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                        <p className="font-medium text-muted-foreground mb-2">Scheduled dates:</p>
                        {dates.map((d, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-muted-foreground">Session {i + 1} of {sessions}</span>
                            <span className="font-mono">{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Fast-track: a course with no consultation on record. Allowed,
                  but the reason goes on the record's audit trail. */}
              {needsSkipReason && (
                <div className="space-y-1.5 rounded-md border border-amber-500/50 bg-amber-50/50 p-3 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    No consultation on record for this customer
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fine for someone already experienced - just say why, for the
                    record.
                  </p>
                  <Textarea
                    rows={2}
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="e.g. existing patient, treated with us since March"
                  />
                </div>
              )}

              {!isCourse && intakeFee === undefined && (
                <p className="rounded-md border border-dashed p-3 text-xs text-amber-600 dark:text-amber-400">
                  No catalogue price for this service yet - add it on the Services
                  page, or type the price below.
                </p>
              )}

              <FormField
                control={form.control}
                name="quotedPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isCourse
                        ? "Course price (₹) - auto from the rate table"
                        : "Fee (₹) - auto from the services catalogue"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Auto-filled from sessions × tier rate"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : e.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment - the gate for the therapist grid (same rule as the
                  Enquiry funnel; the server backs it via createBooking). */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Payment</p>
                <p className="text-xs text-muted-foreground">
                  Payment must be clear before a therapist is assigned.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Amount (₹)</label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={form.watch("paymentAmount") ?? grandTotal ?? ""}
                      onChange={(e) =>
                        form.setValue(
                          "paymentAmount",
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Method</label>
                    <Select
                      value={form.watch("paymentMethod") ?? ""}
                      onValueChange={(v) =>
                        form.setValue(
                          "paymentMethod",
                          v as z.infer<typeof slotBookingZodSchema>["paymentMethod"],
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Discount section */}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">Discount (optional)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Original Price (₹)</label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Price before discount"
                          value={form.watch("originalPrice") ?? ""}
                          onChange={(e) =>
                            form.setValue(
                              "originalPrice",
                              e.target.value === "" ? undefined : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Discount</label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Amount"
                          value={form.watch("discountAmount") ?? ""}
                          onChange={(e) =>
                            form.setValue(
                              "discountAmount",
                              e.target.value === "" ? undefined : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Type</label>
                        <Select
                          value={form.watch("discountType") ?? ""}
                          onValueChange={(v) =>
                            form.setValue(
                              "discountType",
                              v as "fixed" | "percent",
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed (₹)</SelectItem>
                            <SelectItem value="percent">Percentage (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Promo Code</label>
                      <Input
                        type="text"
                        placeholder="e.g. FIRST10, WELCOME20"
                        value={form.watch("discountCode") ?? ""}
                        onChange={(e) =>
                          form.setValue(
                            "discountCode",
                            e.target.value === "" ? undefined : e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.watch("paymentReceived") ?? false}
                    onChange={(e) => {
                      const on = e.target.checked;
                      form.setValue("paymentReceived", on);
                      form.setValue(
                        "paymentReceivedAt",
                        on ? new Date().toISOString() : undefined,
                      );
                      if (on && form.watch("paymentAmount") == null) {
                        form.setValue("paymentAmount", grandTotal);
                      }
                    }}
                  />
                  Payment received
                </label>
                {/* Before payment: ask for it (mirrors the enquiry drawer).
                    After: send the receipt. Only ever one. */}
                {form.watch("paymentReceived") ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={sendPaymentConfirmedWa}
                  >
                    Send payment confirmed
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={requesting}
                    onClick={requestPaymentWa}
                  >
                    {requesting ? "Sending…" : "Request payment on WhatsApp"}
                  </Button>
                )}
              </div>

              {/* Session-only by default; attach + stack services on top */}
              <div className="rounded-md border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachServices}
                    onChange={(e) => toggleAttach(e.target.checked)}
                  />
                  Add service(s) to this booking
                </label>

                {attachServices && (
                  <div className="space-y-2">
                    {stacked.map((row, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={row.serviceId}
                            onValueChange={(v) => patchStacked(i, { serviceId: v })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pick a service" />
                            </SelectTrigger>
                            <SelectContent>
                              {servicesLoading ? (
                                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Loading…
                                </div>
                              ) : (
                                services.map((s) => (
                                  <SelectItem key={s.serviceId} value={s.serviceId}>
                                    {s.name} - ₹{addonPrice(s, row.discount)}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.discount}
                              onChange={(e) =>
                                patchStacked(i, { discount: e.target.checked })
                              }
                            />
                            disc
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStacked(i)}
                            aria-label={`Remove service ${i + 1}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        {/* Multi-session toggle and input - only show when service is selected */}
                        {row.serviceId && (
                          <div className="flex items-center gap-2 pl-2">
                            <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!row.sessions && row.sessions > 1}
                                onChange={(e) =>
                                  patchStacked(i, { sessions: e.target.checked ? 2 : undefined })
                                }
                              />
                              Multi-session
                            </label>
                            {row.sessions && row.sessions > 1 && (
                              <Input
                                type="number"
                                min={2}
                                max={100}
                                value={row.sessions}
                                onChange={(e) =>
                                  patchStacked(i, {
                                    sessions: e.target.value === "" ? 2 : Math.max(2, Number(e.target.value)),
                                  })
                                }
                                className="w-20 h-7 text-xs"
                                placeholder="Qty"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addStacked}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add service
                    </Button>
                  </div>
                )}
              </div>

              {/* Live price breakdown when services are stacked on the session */}
              {attachServices && stackedPriced.some((r) => r.svc) && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Session ×{sessions ?? 0}</span>
                    <span className="tabular-nums">{formatINR(quotedPrice ?? 0)}</span>
                  </div>
                  {stackedPriced
                    .filter((r) => r.svc)
                    .map((r, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>
                          {r.svc?.name}
                          {r.discount && !r.usesTiers ? " (disc)" : ""}
                          {r.sessions && r.sessions > 1
                            ? ` (${formatINR(r.unitPrice)}/session × ${r.sessions})`
                            : ""}
                        </span>
                        <span className="tabular-nums">+ {formatINR(r.price)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Total</span>
                    <span className="tabular-nums">{formatINR(grandTotal)}</span>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Age"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : e.target.valueAsNumber,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phonenumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <PhoneInput {...field} placeholder="10-digit mobile number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Required, checked in blockingReason() alongside the other
                  booking rules so both save paths enforce it. */}
              <FormItem>
                <FormLabel>How did they reach us?</FormLabel>
                <BookingSourceField
                  value={{
                    source: (form.watch("source") ?? "") as BookingSource | "",
                    referredByDoctorId: form.watch("referredByDoctorId"),
                  }}
                  onChange={(next) => {
                    form.setValue("referredByDoctorId", next.referredByDoctorId ?? null);
                    form.setValue("source", next.source ?? "", { shouldDirty: true });
                  }}
                />
              </FormItem>

              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Booking...
                  </span>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Soft-warn when the start is within the booking gap of another visit.
        Overlap never reaches here - it's blocked with a toast in onSubmit.
        Rendered as a sibling of Dialog (not nested in DialogContent) so it
        isn't caught in the Dialog overlay's pointer-events trap - same
        pattern as enquiry-detail-drawer.tsx. */}
    <AlertDialog
      open={pendingTooClose !== null}
      onOpenChange={(o) => {
        if (!o) setPendingTooClose(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Within the booking gap</AlertDialogTitle>
          <AlertDialogDescription>
            This start is within {gapMinutes} min of{" "}
            {pendingTooClose?.conflict.with?.name}&apos;s{" "}
            {pendingTooClose?.conflict.with?.time} visit. Book anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingTooClose(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              const p = pendingTooClose;
              setPendingTooClose(null);
              if (p) submitBooking(p.payload);
            }}
          >
            Book anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
