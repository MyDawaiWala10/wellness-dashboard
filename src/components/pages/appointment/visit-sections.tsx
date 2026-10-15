"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Stethoscope } from "lucide-react";
import { toast } from "sonner";

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
import { useGetServices } from "@/data/service/service";
import { useGetSessionRates } from "@/data/session-rate/session-rate";
import {
  useAddAppointmentRecommendation,
  useConfirmAppointmentRecommendation,
} from "@/data/appointment/appointment";
import type { slotBookingZodType } from "@/type/schema";
import { addonPrice, recommendedAddonTotal } from "@/lib/service-pricing";
import { whatsAppLink } from "@/lib/whatsapp";
import { sendAddonOtp } from "@/actions/appointments/addon-otp";
import { getPackageProgressForAppointment } from "@/lib/package-progress";
import { addonPaid } from "@/lib/booking-money";
import { toDayKey } from "@/components/pages/enquiries/booking";
import { formatINR } from "@/components/pages/services/services-columns";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { format } from "date-fns";

const DURATIONS = [30, 60, 90, 120];

/** "Mon, 16 Nov 2026 · 11:30 (60 min), every 7 days" */
function scheduleLabel(rec: { slot?: { date: string; time: string }; durationMin?: number; intervalDays?: number; sessions?: number }) {
  if (!rec.slot?.date) return "";
  const when = `${format(new Date(`${rec.slot.date}T00:00:00`), "EEE, d MMM yyyy")} · ${rec.slot.time} (${rec.durationMin ?? 60} min)`;
  return (rec.sessions ?? 1) > 1 && rec.intervalDays ? `${when}, every ${rec.intervalDays} days` : when;
}

function PaymentBadge({
  paid,
  label,
}: {
  paid: boolean;
  label: string;
}) {
  return (
    <Badge
      variant={paid ? "default" : "outline"}
      className={
        paid
          ? "bg-emerald-600 text-white"
          : "border-amber-500 text-amber-700 dark:text-amber-400"
      }
    >
      {label}: {paid ? "Received" : "Pending"}
    </Badge>
  );
}

export function AddonsVisitSection({
  appointment,
}: {
  appointment: slotBookingZodType;
}) {
  const { data: services = [] } = useGetServices();
  const { data: rateCard } = useGetSessionRates();
  const tiers = rateCard?.tiers ?? [];
  const { mutate: addRecommendation, isPending } = useAddAppointmentRecommendation();
  const { mutate: confirmRecommendation, isPending: isConfirming } =
    useConfirmAppointmentRecommendation();

  const stacked = appointment.recommendedServices ?? [];
  const [showAddForm, setShowAddForm] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [sessions, setSessions] = useState<number | undefined>(undefined);
  // When it will be done - by this booking's own therapist. Defaults to
  // this visit's day and start time.
  const visitDay = toDayKey(appointment.slot?.date || appointment.physioSlot?.date) || format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(visitDay);
  const [time, setTime] = useState(appointment.therapyStartTime || appointment.slot?.time || "");
  const [durationMin, setDurationMin] = useState(60);
  const [intervalDays, setIntervalDays] = useState(7);
  // Therapist-recommended add-ons are charged the discounted price by default;
  // uncheck to charge the original (e.g. requested after the therapist left).
  const [applyDiscount, setApplyDiscount] = useState(true);
  // Consent code per add-on, keyed by serviceId|recommendedAt.
  const [codes, setCodes] = useState<Record<string, string>>({});

  // No new add-ons once the package or single visit is fully complete.
  const progress = getPackageProgressForAppointment(appointment, [appointment], services);
  const allSessionsDone = progress
    ? progress.completed >= progress.total
    : appointment.status === "completed";

  const selected = services.find((s) => s.serviceId === serviceId);
  const pricing = recommendedAddonTotal(
    tiers,
    sessions,
    selected,
    applyDiscount,
  );
  const noTier =
    !!sessions && sessions > 1 && pricing.usesTiers && pricing.total === 0;

  // Keep amount in sync with service, discount, and session count.
  useEffect(() => {
    if (!serviceId) return;
    if (pricing.total > 0) {
      setAmount(String(pricing.total));
    }
  }, [serviceId, pricing.total, applyDiscount, sessions]);

  function handleSelect(id: string) {
    setServiceId(id);
    setSessions(undefined);
  }

  function handleToggleDiscount(next: boolean) {
    setApplyDiscount(next);
  }

  function handleAdd() {
    if (!appointment._id || !selected) return;
    if (noTier) {
      toast.error(`No rate tier for ${sessions} sessions`);
      return;
    }
    if (!date || !time) {
      toast.error("Pick the date and time it will be done");
      return;
    }
    const quotedPrice = pricing.total;
    if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    addRecommendation(
      {
        appointmentId: appointment._id,
        values: {
          serviceId: selected.serviceId,
          serviceName: selected.name,
          quotedPrice,
          sessions: sessions && sessions > 1 ? sessions : undefined,
          slot: { date, time },
          durationMin,
          intervalDays: sessions && sessions > 1 ? intervalDays : undefined,
        },
      },
      {
        onSuccess: () => {
          setServiceId("");
          setAmount("");
          setSessions(undefined);
          setShowAddForm(false);
        },
      },
    );
  }

  async function handleSendCode(recServiceId: string, recommendedAt: string) {
    if (!appointment._id) return;
    const r = await sendAddonOtp(appointment._id, recServiceId, recommendedAt);
    if (!r.success || !r.code) {
      toast.error(r.message ?? "Could not create a code");
      return;
    }
    const rec = stacked.find(
      (s) => s.serviceId === recServiceId && s.recommendedAt === recommendedAt,
    );
    const link = whatsAppLink(
      appointment.phonenumber,
      `Your MDW confirmation code for ${rec?.serviceName ?? "the add-on"}` +
        `${rec ? ` (${formatINR(rec.quotedPrice)})` : ""} is ${r.code}`,
    );
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    else toast.error("This customer's number can't be messaged on WhatsApp");
  }

  function handleConfirm(recServiceId: string, recommendedAt: string) {
    if (!appointment._id) return;
    confirmRecommendation({
      appointmentId: appointment._id,
      serviceId: recServiceId,
      recommendedAt,
      code: (codes[`${recServiceId}|${recommendedAt}`] ?? "").trim(),
    });
  }

  if (stacked.length === 0 && !showAddForm) {
    return (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={allSessionsDone}
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Recommend a service
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Stethoscope className="h-4 w-4" />
          Recommended add-ons
        </h3>
        {!showAddForm && !allSessionsDone && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        )}
      </div>

      {stacked.length > 0 && (
        <ul className="space-y-2">
          {stacked.map((rec, i) => {
            const isConfirmed = rec.status === "confirmed";
            return (
              <li
                key={`${rec.serviceId}-${rec.recommendedAt}-${i}`}
                className="rounded-md border bg-background p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">
                    {rec.serviceName}
                    {rec.sessions && rec.sessions > 1 ? ` ×${rec.sessions}` : ""}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {formatINR(rec.quotedPrice)}
                  </Badge>
                </div>
                {rec.sessions && rec.sessions > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    {formatINR(Math.round(rec.quotedPrice / rec.sessions))}/session
                    × {rec.sessions}
                  </p>
                )}
                {rec.slot?.date && (
                  <p className="text-[11px] text-muted-foreground">
                    {scheduleLabel(rec)} · {appointment.doctor ?? "this therapist"}
                    {rec.firstInVisit === false || (rec.sessions ?? 1) > 1
                      ? " - later sessions are their own visits"
                      : ""}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={isConfirmed ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {isConfirmed ? "Customer confirmed" : "Awaiting customer"}
                  </Badge>
                  {isConfirmed && (
                    <PaymentBadge
                      paid={addonPaid(rec) >= rec.quotedPrice}
                      label={
                        addonPaid(rec) > 0 && addonPaid(rec) < rec.quotedPrice
                          ? `Paid ${formatINR(addonPaid(rec))} of ${formatINR(rec.quotedPrice)}`
                          : "Add-on payment"
                      }
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {rec.status === "pending" && (
                    /* Consent by code, not by staff assertion: the customer
                       reads back a code they were sent, and that IS the
                       confirmation. */
                    <div className="flex w-full gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={() =>
                          handleSendCode(rec.serviceId, rec.recommendedAt)
                        }
                      >
                        Send code
                      </Button>
                      <Input
                        className="h-8"
                        placeholder="Code from customer"
                        aria-label={`Confirmation code for ${rec.serviceName}`}
                        value={codes[`${rec.serviceId}|${rec.recommendedAt}`] ?? ""}
                        onChange={(e) =>
                          setCodes((c) => ({
                            ...c,
                            [`${rec.serviceId}|${rec.recommendedAt}`]:
                              e.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={
                          isConfirming ||
                          !(
                            codes[`${rec.serviceId}|${rec.recommendedAt}`] ?? ""
                          ).trim()
                        }
                        onClick={() =>
                          handleConfirm(rec.serviceId, rec.recommendedAt)
                        }
                      >
                        {isConfirming ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Confirm
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  {isConfirmed && appointment._id && (
                    <div className="w-full">
                      <RecordPaymentForm
                        appointmentId={appointment._id}
                        addon={`${rec.serviceId}|${rec.recommendedAt}`}
                        due={Math.max(0, rec.quotedPrice - addonPaid(rec))}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showAddForm && !allSessionsDone && (
        <div className="space-y-2 border-t pt-3">
          <Select value={serviceId} onValueChange={handleSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.serviceId} value={s.serviceId}>
                  {s.name} - ₹{addonPrice(s, applyDiscount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={applyDiscount}
              onChange={(e) => handleToggleDiscount(e.target.checked)}
            />
            Apply discount (therapist-recommended on the spot)
          </label>
          <Input
            type="number"
            min={0}
            value={amount}
            placeholder="Amount ₹"
            readOnly
          />
          {serviceId && pricing.total > 0 && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {sessions && sessions > 1
                ? `${formatINR(pricing.perSession)}/session × ${sessions} = ${formatINR(pricing.total)}`
                : `${formatINR(pricing.perSession)} per session`}
            </p>
          )}
          {noTier && (
            <p className="text-[11px] text-destructive">
              No rate tier for {sessions} sessions — add one on the Services page.
            </p>
          )}
          {/* Multi-session option - only show when service is selected */}
          {serviceId && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!sessions && sessions > 1}
                  onChange={(e) => setSessions(e.target.checked ? 2 : undefined)}
                />
                Multi-session add-on
              </label>
              {sessions && sessions > 1 && (
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={sessions}
                  onChange={(e) =>
                    setSessions(e.target.value === "" ? 2 : Math.max(2, Number(e.target.value)))
                  }
                  className="w-20 h-7 text-xs"
                  placeholder="Qty"
                />
              )}
            </div>
          )}
          {serviceId && (
            <div className="space-y-1.5 rounded-md border bg-background p-2">
              <p className="text-[11px] font-medium">
                When - done by {appointment.doctor ?? "this booking's therapist"}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  type="date"
                  className="h-8"
                  aria-label="Date"
                  min={format(new Date(), "yyyy-MM-dd")}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Input
                  type="time"
                  className="h-8"
                  aria-label="Start time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
                <Select value={String(durationMin)} onValueChange={(v) => setDurationMin(Number(v))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sessions && sessions > 1 && (
                <label className="flex items-center gap-2 text-xs">
                  Every
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    className="h-7 w-16 text-xs"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
                  />
                  days
                </label>
              )}
              <p className="text-[11px] text-muted-foreground">
                {date === visitDay
                  ? "First session in this visit."
                  : "This becomes its own visit on that day."}
                {sessions && sessions > 1 ? " Later sessions become their own visits." : ""}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={isPending || !serviceId || noTier || pricing.total <= 0 || !date || !time}
            >
              Add to this visit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

