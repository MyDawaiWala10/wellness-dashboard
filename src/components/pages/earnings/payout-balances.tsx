"use client";

import { Fragment, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard, MetricCardsRow } from "@/components/metric-card";
import { Money } from "@/components/money";
import { formatINR } from "@/components/pages/services/services-columns";
import { useGetPayoutBalances, useRecordSettlement } from "@/data/payouts/payouts";
import type { PayoutBalance } from "@/actions/payouts/payouts";
import { cn } from "@/lib/utils";

const when = (at: string) => format(new Date(at), "d MMM yyyy, HH:mm");
const inRange = (at: string, from?: string, to?: string) => {
  const day = format(new Date(at), "yyyy-MM-dd");
  return (!from || day >= from) && (!to || day <= to);
};

/**
 * Who pays whom, in plain words (owner asked for this, 2026-11-12). A positive
 * balance means the company pays the therapist; negative means the therapist
 * pays the company. Every payout surface uses this wording.
 */
export function payDirection(remaining: number, you = false): string {
  if (remaining === 0) return "All settled";
  if (remaining > 0) return you ? "Company pays you" : "Company pays therapist";
  return you ? "You pay company" : "Therapist pays company";
}

/** "₹1,560 earned − ₹1,600 cash collected − ₹0 company already paid = Therapist pays company ₹40" */
function Breakdown({ b, you }: { b: PayoutBalance; you?: boolean }) {
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {formatINR(b.earned)} {you ? "you earned" : "earned"} − {formatINR(b.cashTotal)}{" "}
      {you ? "cash you collected" : "cash collected"} − {formatINR(b.paid)} company already paid{you ? " you" : ""}
      {b.received > 0 ? ` + ${formatINR(b.received)} ${you ? "you" : "therapist"} paid back` : ""} ={" "}
      <Remaining value={b.remaining} you={you} />
    </p>
  );
}

/** The cash a therapist took, booking by booking (within the page's dates, if set). */
function CashList({ b, from, to }: { b: PayoutBalance; from?: string; to?: string }) {
  const items = b.cash.filter((c) => inRange(c.at, from, to));
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{b.cash.length ? "No cash in these dates." : "No cash collected."}</p>;
  }
  return (
    <ul className="divide-y rounded-md border text-sm">
      {items.map((c, i) => (
        <li key={`${c.enquiryId}-${c.at}-${i}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
          <span className="font-mono text-xs">{c.enquiryId || "-"}</span>
          <span className="flex-1 text-xs text-muted-foreground">{when(c.at)}</span>
          <Money value={c.amount} className="font-medium" />
        </li>
      ))}
    </ul>
  );
}

/** "₹1,600 · 1 payment": opens the list of bookings that paid this therapist cash. */
function CashToggle({ b, expanded, onToggle }: { b: PayoutBalance; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`Cash collected ${formatINR(b.cashTotal)} from ${b.cash.length} cash ${b.cash.length === 1 ? "payment" : "payments"}: ${expanded ? "hide" : "show"} the details`}
      className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      {formatINR(b.cashTotal)}
      <span className="text-xs text-muted-foreground">
        · {b.cash.length} cash {b.cash.length === 1 ? "payment" : "payments"}
      </span>
    </button>
  );
}

/** "Company pays therapist ₹20,000" / "Therapist pays company ₹40" / "All settled". */
function Remaining({ value, you }: { value: number; you?: boolean }) {
  if (value === 0) return <span className="text-muted-foreground">{payDirection(0)}</span>;
  return (
    <span className={cn("font-semibold tabular-nums", value < 0 && "text-amber-700 dark:text-amber-400")}>
      {payDirection(value, you)} {formatINR(Math.abs(value))}
    </span>
  );
}

/**
 * Therapist payouts (owner's rules, 2026-11-12): what each therapist earned,
 * the company cash they collected, and who pays whom, all time. The
 * server works it all out (WellnessBackend lib/payouts.ts payoutBalances).
 */
export function PayoutBalances({ isAdmin, from, to }: { isAdmin: boolean; from?: string; to?: string }) {
  const { data: balances = [], isLoading, isError, error } = useGetPayoutBalances();

  if (isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading payouts…</CardContent></Card>;
  }
  if (isError) {
    return <Card><CardContent className="py-6 text-sm text-destructive">{(error as Error).message}</CardContent></Card>;
  }
  return isAdmin ? <AdminPayouts balances={balances} from={from} to={to} /> : <TherapistPayout b={balances[0]} from={from} to={to} />;
}

function TherapistPayout({ b, from, to }: { b?: PayoutBalance; from?: string; to?: string }) {
  if (!b) return null;
  const owes = b.remaining < 0;
  return (
    <section className="space-y-3">
      <MetricCardsRow>
        <MetricCard label="Total earned" value={formatINR(b.earned)} hint="Your cut of done, paid sessions" />
        <MetricCard
          label="Cash you collected"
          value={formatINR(b.cashTotal)}
          hint={`${b.cash.length} cash ${b.cash.length === 1 ? "payment" : "payments"}. Company money, so it comes off your pay`}
        />
        <MetricCard
          label={payDirection(b.remaining, true)}
          value={formatINR(Math.abs(b.remaining))}
          hint={
            owes
              ? "You collected more cash than you earned"
              : b.remaining > 0
                ? "What the company still has to pay you"
                : "Nobody owes anything"
          }
          className={owes ? "border-amber-300 dark:border-amber-800" : undefined}
        />
      </MetricCardsRow>
      <Breakdown b={b} you />
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Cash you collected</p>
        <CashList b={b} from={from} to={to} />
      </div>
    </section>
  );
}

function AdminPayouts({ balances, from, to }: { balances: PayoutBalance[]; from?: string; to?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [settling, setSettling] = useState<PayoutBalance | null>(null);
  const toPay = balances.reduce((t, b) => t + Math.max(0, b.remaining), 0);
  const toGet = balances.reduce((t, b) => t + Math.max(0, -b.remaining), 0);

  return (
    <Card className="gap-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4">
        <div>
          <h2 className="text-base font-semibold">Therapist payouts</h2>
          <p className="text-xs text-muted-foreground">
            All time. Cash a therapist collects from a customer is company money, so it comes off what the company pays them.
          </p>
        </div>
        <div className="text-sm sm:text-right">
          <p>
            Company has to pay therapists: <Money value={toPay} className="font-semibold" />
          </p>
          {toGet > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              Therapists have to pay company: <Money value={toGet} className="font-semibold" />
            </p>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Therapist</TableHead>
              {/* On a phone these two sit under the name, so Who pays whom and the button stay in view. */}
              <TableHead className="hidden text-right sm:table-cell">Total earned</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Cash collected</TableHead>
              <TableHead className="text-right">Who pays whom</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No therapist has earned anything yet.
                </TableCell>
              </TableRow>
            ) : (
              balances.map((b) => {
                const expanded = open === b.doctorId;
                return (
                  <Fragment key={b.doctorId}>
                    <TableRow>
                      <TableCell className="pl-4">
                        <p className="font-medium">{b.doctor}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:hidden">
                          <span>Earned {formatINR(b.earned)}</span>
                          <CashToggle b={b} expanded={expanded} onToggle={() => setOpen(expanded ? null : b.doctorId)} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell"><Money value={b.earned} /></TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <CashToggle b={b} expanded={expanded} onToggle={() => setOpen(expanded ? null : b.doctorId)} />
                      </TableCell>
                      <TableCell className="whitespace-normal text-right sm:whitespace-nowrap"><Remaining value={b.remaining} /></TableCell>
                      <TableCell className="pr-3 text-right sm:pr-4">
                        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSettling(b)}>
                          Record payment
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="space-y-2 bg-muted/30 px-4 py-3">
                          <Breakdown b={b} />
                          <CashList b={b} from={from} to={to} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {settling && <SettleDialog b={settling} onClose={() => setSettling(null)} />}
    </Card>
  );
}

/** Record money that changed hands: the company paying the therapist, or the therapist paying the company. */
function SettleDialog({ b, onClose }: { b: PayoutBalance; onClose: () => void }) {
  // Start from what would square the balance.
  const [direction, setDirection] = useState<"paid" | "received">(b.remaining < 0 ? "received" : "paid");
  const [amount, setAmount] = useState(b.remaining === 0 ? "" : String(Math.abs(b.remaining)));
  const [note, setNote] = useState("");
  const { mutate, isPending } = useRecordSettlement();
  const value = Math.round(Number(amount));
  const valid = Number.isFinite(value) && value >= 1;
  const after = b.remaining + (direction === "paid" ? -value : value);

  function save() {
    if (!valid) return;
    mutate({ doctorId: b.doctorId, amount: value, direction, note: note.trim() || undefined }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment: {b.doctor}</DialogTitle>
          <DialogDescription>
            Right now: <Remaining value={b.remaining} />
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Who paid whom">
          {(
            [
              ["paid", "Company paid the therapist"],
              ["received", "Therapist paid the company"],
            ] as const
          ).map(([d, label]) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={cn(
                "min-h-10 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                direction === d ? "border-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settle-amount">Amount (₹)</Label>
          <Input
            id="settle-amount"
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-nums"
          />
          {amount !== "" && !valid && <p className="text-xs text-destructive">Enter at least ₹1.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settle-note">Note (optional)</Label>
          <Input
            id="settle-note"
            placeholder="UPI ref, or cash handed over at the office"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {valid && (
          <p className="text-sm">
            After this: <Remaining value={after} />
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!valid || isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
