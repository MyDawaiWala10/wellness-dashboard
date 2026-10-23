"use client";

/**
 * "Apply offer" box on a saved booking's Billing tab.
 *
 * One row per priced line (the booking's own fee + every confirmed add-on).
 * For each line we build a role-filtered dropdown of the offers this user may
 * apply — using the SAME pure rules as the server (lib/offers.ts) so the list
 * matches what apply-offer will actually accept. The browser NEVER sends a
 * price: picking an offer calls the server, which recomputes the rupees and
 * re-checks every rule (including once-per-phone, which we can't see here).
 * Removal restores the line's base price and frees the redemption.
 */

import { useState } from "react";
import { BadgePercent, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/providers/permission-provider";
import { useApplyOffer, useGetOffers, useRemoveOffer } from "@/data/offer/offer";
import { applicableOffers, computeOfferOff, type OfferLineKind } from "@/lib/offers";
import { formatINR } from "@/components/pages/services/services-columns";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import type { Offer, slotBookingZodType } from "@/type/schema";

/** Roles that may apply/remove an offer — the office, never a Therapist. */
const OFFICE = new Set(["SUPER_ADMIN", "ADMIN", "STAFF", "CUSTOMER_CARE"]);

/** The add-on key the SERVER expects: serviceId|recommendedAt (pipe, not dash). */
const pipeKey = (serviceId: string, recommendedAt: string) => `${serviceId}|${recommendedAt}`;

/** Stable, non-empty key for the offer dropdown (offerId is server-allocated). */
const offerKey = (o: Offer) => o.offerId ?? o._id ?? o.code ?? "";

type AppliedEntry = NonNullable<slotBookingZodType["appliedOffers"]>[number];

type Line = {
  key: string;
  label: string;
  /** Eligibility context: course-aware for the booking's own fee. */
  lineKind: OfferLineKind;
  /** What we send the apply/remove endpoint (it normalises course → main). */
  apiLineKind: "main" | "add_on";
  /** Pre-offer base the discount is computed against. */
  base: number;
  serviceId?: string;
  addonKey?: string;
};

export function OfferApplyBox({ appointment }: { appointment: slotBookingZodType }) {
  const role = useAuthStore((s) => s.user?.role);
  const { data: offers } = useGetOffers();
  const applyOffer = useApplyOffer();
  const removeOffer = useRemoveOffer();

  if (!role || !OFFICE.has(role)) return null;
  const bookingId = appointment._id;
  if (!bookingId) return null;

  const lines: Line[] = [];

  const fee = appointment.quotedPrice ?? 0;
  if (fee > 0) {
    const isCourse = appointment.bookingKind === "course";
    lines.push({
      key: "booking",
      label: bookingLabel(appointment),
      lineKind: isCourse ? "course" : "main",
      apiLineKind: "main",
      base: appointment.originalPrice ?? fee,
      serviceId: appointment.packageServiceId,
    });
  }

  for (const r of appointment.recommendedServices ?? []) {
    if (r.status !== "confirmed") continue;
    const key = pipeKey(r.serviceId, r.recommendedAt);
    lines.push({
      key,
      label: r.serviceName,
      lineKind: "add_on",
      apiLineKind: "add_on",
      base: r.quotedPrice ?? 0,
      serviceId: r.serviceId,
      addonKey: key,
    });
  }

  if (lines.length === 0) return null;

  const appliedFor = (l: Line): AppliedEntry | undefined =>
    (appointment.appliedOffers ?? []).find((a) =>
      l.apiLineKind === "add_on"
        ? a.lineKind === "add_on" && a.addonKey === l.addonKey
        : (a.lineKind === "main" || a.lineKind === "course") && !a.addonKey,
    );

  const busy = applyOffer.isPending || removeOffer.isPending;

  return (
    <section className="rounded-lg border p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Offers
      </p>
      {lines.map((l) => (
        <OfferLine
          key={l.key}
          line={l}
          offers={offers ?? []}
          userRole={role}
          applied={appliedFor(l)}
          busy={busy}
          onApply={(id, note) =>
            applyOffer.mutate({
              bookingId,
              offerId: id,
              lineKind: l.apiLineKind,
              ...(l.apiLineKind === "add_on" ? { addonKey: l.addonKey } : {}),
              ...(note ? { note } : {}),
            })
          }
          onRemove={() =>
            removeOffer.mutate({
              bookingId,
              lineKind: l.apiLineKind,
              ...(l.apiLineKind === "add_on" ? { addonKey: l.addonKey } : {}),
            })
          }
        />
      ))}
    </section>
  );
}

function OfferLine({
  line,
  offers,
  userRole,
  applied,
  busy,
  onApply,
  onRemove,
}: {
  line: Line;
  offers: Offer[];
  userRole: string;
  applied?: AppliedEntry;
  busy: boolean;
  onApply: (offerId: string, note: string) => void;
  onRemove: () => void;
}) {
  const [picked, setPicked] = useState("");
  const [note, setNote] = useState("");

  // A line already carrying an offer shows it + a Remove control, not a picker.
  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-dashed py-2 last:border-0">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{line.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {applied.offerName ?? applied.code}
            {" · "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatINR(applied.off ?? 0)} off
            </span>
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} disabled={busy}>
          <X className="size-3.5" />
          Remove
        </Button>
      </div>
    );
  }

  const eligible = applicableOffers(offers, line.base, {
    userRole,
    lineKind: line.lineKind,
    serviceId: line.serviceId,
  });

  if (eligible.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-dashed py-2 last:border-0">
        <p className="truncate text-[13px] font-medium">{line.label}</p>
        <span className="text-[11px] text-muted-foreground">No offer available</span>
      </div>
    );
  }

  const selected = eligible.find((o) => offerKey(o) === picked);
  const preview = selected ? computeOfferOff(selected, line.base).off : 0;
  const needsNote = !!selected?.noteRequired && !note.trim();

  return (
    <div className="space-y-1.5 border-b border-dashed py-2 last:border-0">
      <p className="truncate text-[13px] font-medium">{line.label}</p>
      <div className="flex items-center gap-2">
        <Select value={picked} onValueChange={setPicked}>
          <SelectTrigger className="h-8 flex-1 text-[13px]">
            <SelectValue placeholder="Apply offer…" />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((o) => (
              <SelectItem key={offerKey(o)} value={offerKey(o)}>
                {o.name} − {formatINR(computeOfferOff(o, line.base).off)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={() => onApply(picked, note.trim())}
          disabled={!picked || busy || needsNote}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <BadgePercent className="size-3.5" />
          )}
          Apply{preview > 0 ? ` −${formatINR(preview)}` : ""}
        </Button>
      </div>
      {selected?.noteRequired && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (required for this offer)"
          className="h-8 text-[13px]"
        />
      )}
    </div>
  );
}
