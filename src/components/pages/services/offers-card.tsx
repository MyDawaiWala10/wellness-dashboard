"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RefreshButton } from "@/components/refresh-button";
import { QueryWrapper } from "@/components/query-wrapper";
import { useAuthStore } from "@/providers/permission-provider";
import {
  useAddOffer,
  useDeleteOffer,
  useGetOffers,
  useUpdateOffer,
} from "@/data/offer/offer";
import type { Offer } from "@/type/schema";

/**
 * Super-Admin "Offers" admin on the Services page: create / edit / delete the
 * merged coupon+discount offers the office can apply to bookings. Reads are
 * open to everyone (the booking form needs the list), but the write controls
 * only render for SUPER_ADMIN — the server re-checks regardless.
 */

// The form keeps everything as strings/flags so inputs stay controlled; the
// number/empty coercion happens in toDraft() on submit.
type OfferFormState = {
  name: string;
  code: string;
  kind: "fixed" | "percent";
  amount: string;
  maxOff: string;
  appliesTo: "all" | "services" | "courses" | "add_ons";
  serviceIds: string; // comma-separated
  minRole: "STAFF" | "ADMIN" | "SUPER_ADMIN";
  absorbedBy: "company" | "therapist";
  validFrom: string;
  validUntil: string;
  totalUses: string;
  oncePerPhone: boolean;
  noteRequired: boolean;
  active: boolean;
};

const blank: OfferFormState = {
  name: "",
  code: "",
  kind: "percent",
  amount: "",
  maxOff: "",
  appliesTo: "all",
  serviceIds: "",
  minRole: "STAFF",
  absorbedBy: "company",
  validFrom: "",
  validUntil: "",
  totalUses: "",
  oncePerPhone: true,
  noteRequired: false,
  active: true,
};

function toForm(o: Offer): OfferFormState {
  return {
    name: o.name ?? "",
    code: o.code ?? "",
    kind: o.kind,
    amount: String(o.amount ?? ""),
    maxOff: o.maxOff == null ? "" : String(o.maxOff),
    appliesTo: o.appliesTo ?? "all",
    serviceIds: (o.serviceIds ?? []).join(", "),
    minRole: o.minRole ?? "STAFF",
    absorbedBy: o.absorbedBy ?? "company",
    validFrom: o.validFrom ? String(o.validFrom).slice(0, 10) : "",
    validUntil: o.validUntil ? String(o.validUntil).slice(0, 10) : "",
    totalUses: o.totalUses == null ? "" : String(o.totalUses),
    oncePerPhone: o.oncePerPhone !== false,
    noteRequired: o.noteRequired === true,
    active: o.active !== false,
  };
}

function toDraft(f: OfferFormState) {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  return {
    name: f.name.trim(),
    code: f.code.trim() === "" ? undefined : f.code.trim().toUpperCase(),
    kind: f.kind,
    amount: num(f.amount) ?? 0,
    maxOff: f.kind === "percent" ? (num(f.maxOff) ?? null) : null,
    appliesTo: f.appliesTo,
    serviceIds:
      f.appliesTo === "services"
        ? f.serviceIds.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    minRole: f.minRole,
    absorbedBy: f.absorbedBy,
    validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : null,
    validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : null,
    totalUses: num(f.totalUses) ?? null,
    oncePerPhone: f.oncePerPhone,
    noteRequired: f.noteRequired,
    active: f.active,
  };
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function discountLabel(o: Offer): string {
  if (o.kind === "percent") {
    return o.maxOff != null ? `${o.amount}% (max ${money(o.maxOff)})` : `${o.amount}%`;
  }
  return `${money(o.amount)} off`;
}

export function OffersCard() {
  const { data: offers = [], isLoading, isError, error, refetch } = useGetOffers();
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferFormState>(blank);

  const addOffer = useAddOffer();
  const updateOffer = useUpdateOffer();
  const deleteOffer = useDeleteOffer();
  const pending = addOffer.isPending || updateOffer.isPending;

  useEffect(() => {
    if (open) setForm(editing ? toForm(editing) : blank);
  }, [open, editing]);

  const set = <K extends keyof OfferFormState>(key: K, value: OfferFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(o: Offer) {
    setEditing(o);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const draft = toDraft(form);
    if (editing?.offerId) {
      updateOffer.mutate(
        { offerId: editing.offerId, values: draft },
        { onSuccess: () => setOpen(false) },
      );
    } else {
      addOffer.mutate(draft, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Offers</CardTitle>
          <CardDescription>
            Discounts the office can apply to a booking line. The server works
            out the rupees at apply time - an offer is a rule, not a price.
            {!isSuperAdmin && " (View only - only Super Admin can edit offers.)"}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RefreshButton onClick={() => refetch()} isFetching={isLoading} />
          {isSuperAdmin && (
            <Button type="button" size="sm" onClick={openAdd}>
              <Plus className="mr-1 h-4 w-4" /> Add offer
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <QueryWrapper
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={refetch}
          skeleton={
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          }
        >
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Min role</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isSuperAdmin ? 8 : 7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No offers yet{isSuperAdmin ? " - add your first one." : "."}
                    </TableCell>
                  </TableRow>
                ) : (
                  offers.map((o) => (
                    <TableRow key={o.offerId ?? o._id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell className="uppercase">{o.code || "—"}</TableCell>
                      <TableCell>{discountLabel(o)}</TableCell>
                      <TableCell>{o.appliesTo ?? "all"}</TableCell>
                      <TableCell>{o.minRole ?? "STAFF"}</TableCell>
                      <TableCell>
                        {o.usedCount ?? 0}
                        {o.totalUses != null ? ` / ${o.totalUses}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={o.active === false ? "secondary" : "default"}>
                          {o.active === false ? "Off" : "Active"}
                        </Badge>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(o)}
                              aria-label={`Edit ${o.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete ${o.name}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete offer?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Removes “{o.name}”. Bookings that already used
                                    it keep their applied discount.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      o.offerId && deleteOffer.mutate(o.offerId)
                                    }
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </QueryWrapper>
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl p-0 gap-0 flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>{editing ? "Edit offer" : "Add offer"}</SheetTitle>
              <SheetDescription>
                {editing
                  ? "The offer id and usage count stay as they are."
                  : "The offer id (OFF-####) is assigned automatically."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="offer-name">Name</Label>
                  <Input
                    id="offer-name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Diwali 20% off"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="offer-code">Code (optional)</Label>
                  <Input
                    id="offer-code"
                    value={form.code}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder="e.g. DIWALI20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Kind</Label>
                  <Select value={form.kind} onValueChange={(v) => set("kind", v as OfferFormState["kind"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="fixed">Fixed (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="offer-amount">
                    {form.kind === "percent" ? "Percent off (%)" : "Amount off (₹)"}
                  </Label>
                  <Input
                    id="offer-amount"
                    type="number"
                    min={0}
                    step={1}
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    placeholder={form.kind === "percent" ? "20" : "500"}
                    required
                  />
                </div>

                {form.kind === "percent" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="offer-max">Max off (₹, optional)</Label>
                    <Input
                      id="offer-max"
                      type="number"
                      min={0}
                      step={1}
                      value={form.maxOff}
                      onChange={(e) => set("maxOff", e.target.value)}
                      placeholder="e.g. 500"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Applies to</Label>
                  <Select
                    value={form.appliesTo}
                    onValueChange={(v) => set("appliesTo", v as OfferFormState["appliesTo"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All lines</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="courses">Courses only</SelectItem>
                      <SelectItem value="add_ons">Add-ons only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.appliesTo === "services" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="offer-services">Service IDs (comma-separated)</Label>
                    <Input
                      id="offer-services"
                      value={form.serviceIds}
                      onChange={(e) => set("serviceIds", e.target.value)}
                      placeholder="SRV-0001, SRV-0002"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Min role to apply</Label>
                  <Select
                    value={form.minRole}
                    onValueChange={(v) => set("minRole", v as OfferFormState["minRole"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAFF">Staff &amp; up</SelectItem>
                      <SelectItem value="ADMIN">Admin &amp; up</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Absorbed by</Label>
                  <Select
                    value={form.absorbedBy}
                    onValueChange={(v) => set("absorbedBy", v as OfferFormState["absorbedBy"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="therapist">Therapist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="offer-from">Valid from (optional)</Label>
                  <Input
                    id="offer-from"
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => set("validFrom", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="offer-until">Valid until (optional)</Label>
                  <Input
                    id="offer-until"
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => set("validUntil", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="offer-uses">Total uses (blank = unlimited)</Label>
                  <Input
                    id="offer-uses"
                    type="number"
                    min={0}
                    step={1}
                    value={form.totalUses}
                    onChange={(e) => set("totalUses", e.target.value)}
                    placeholder="e.g. 100"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.oncePerPhone}
                      onChange={(e) => set("oncePerPhone", e.target.checked)}
                    />
                    Once per phone number
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.noteRequired}
                      onChange={(e) => set("noteRequired", e.target.checked)}
                    />
                    Require a note when applying
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.active}
                      onChange={(e) => set("active", e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Add offer"
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
