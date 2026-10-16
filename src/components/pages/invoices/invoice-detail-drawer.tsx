"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Ban, Phone, Mail, BadgeCheck, FileText, ReceiptText, Pencil, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { PersistedInvoice, UpdateInvoiceInput, InvoicePaymentStatus, InvoiceLineItem } from "@/type/invoice";
import { useUpdateInvoice, useGenerateInvoicePdf, useVoidInvoice } from "@/data/invoice/invoice";
import { whatsAppLink } from "@/lib/whatsapp";
import { diffInvoice, type InvoiceChange } from "./invoice-diff";
import { Textarea } from "@/components/ui/textarea";
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

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceDownloadButton } from "@/components/invoice-download-button";
import { invoiceStatusLabel } from "@/lib/invoice-status";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function safeText(s: unknown): string {
  return typeof s === "string" ? s : "";
}

export function InvoiceDetailDrawer({
  invoice,
  onClose,
}: {
  invoice: PersistedInvoice | null;
  onClose: () => void;
}) {
  const open = invoice !== null;

  const { mutate: updateInvoice, isPending: isUpdating } = useUpdateInvoice();
  const { mutate: generatePdf, isPending: isGeneratingPdf } = useGenerateInvoicePdf();
  const { mutate: voidInvoiceMut, isPending: isVoiding } = useVoidInvoice();

  const [isEditing, setIsEditing] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [draft, setDraft] = useState<PersistedInvoice | null>(invoice);

  // ── Guards on a settled invoice ──
  // A paid invoice is a document the customer already holds a copy of, so it
  // isn't editable by a stray click: entering edit mode asks first, and saving
  // shows exactly what's about to move.
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: UpdateInvoiceInput;
    changes: InvoiceChange[];
  } | null>(null);

  const isPaid = invoice?.payment_status === "paid" && !invoice?.voided;

  useEffect(() => {
    setDraft(invoice);
    setIsEditing(false);
    setConfirmEditOpen(false);
    setPendingSave(null);
  }, [invoice?.invoice_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createdAtText = useMemo(() => {
    if (!invoice?.createdAt) return "-";
    const d = new Date(invoice.createdAt);
    if (Number.isNaN(d.getTime())) return "-";
    return format(d, "yyyy-MM-dd HH:mm");
  }, [invoice?.createdAt]);

  function setLineItem(i: number, patch: Partial<InvoiceLineItem>) {
    if (!draft) return;
    const next = [...(draft.line_items ?? [])];
    next[i] = { ...next[i], ...patch };
    const advancePaid = Number(draft.advance_paid ?? 0) || 0;
    const subtotal = next.reduce((sum, li) => sum + (Number(li.price) || 0), 0);
    const total = subtotal;
    const balanceDue = total - advancePaid;
    setDraft({
      ...draft,
      line_items: next,
      items_subtotal: subtotal,
      total,
      balance_due: balanceDue,
    });
  }

  function addLineItem() {
    if (!draft) return;
    const next = [
      ...(draft.line_items ?? []),
      { description: "", price: 0 },
    ];
    const advancePaid = Number(draft.advance_paid ?? 0) || 0;
    const subtotal = next.reduce((sum, li) => sum + (Number(li.price) || 0), 0);
    const total = subtotal;
    const balanceDue = total - advancePaid;
    setDraft({
      ...draft,
      line_items: next,
      items_subtotal: subtotal,
      total,
      balance_due: balanceDue,
    });
  }

  function removeLineItem(i: number) {
    if (!draft) return;
    if ((draft.line_items ?? []).length <= 1) {
      toast.error("An invoice needs at least one line item.");
      return;
    }
    const next = [...(draft.line_items ?? [])];
    next.splice(i, 1);
    const advancePaid = Number(draft.advance_paid ?? 0) || 0;
    const subtotal = next.reduce((sum, li) => sum + (Number(li.price) || 0), 0);
    const total = subtotal;
    const balanceDue = total - advancePaid;
    setDraft({ ...draft, line_items: next, items_subtotal: subtotal, total, balance_due: balanceDue });
  }

  /** The normalised payload, or null when the draft isn't valid to save. */
  function buildValues(): UpdateInvoiceInput | null {
    if (!draft) return null;

    const items = (draft.line_items ?? []).map((li) => ({
      description: safeText(li.description).trim() || "Item",
      price: Number(li.price) || 0,
    }));

    if (items.length === 0) {
      toast.error("An invoice needs at least one line item.");
      return null;
    }
    if (items.some((li) => li.price < 0)) {
      toast.error("Line item prices cannot be negative.");
      return null;
    }

    return {
      therapist_name: safeText(draft.therapist_name).trim(),
      session_number: draft.session_number ?? null,
      package_type: draft.package_type ?? null,
      package_ref: draft.package_ref ?? null,
      package_name: safeText(draft.package_name),
      payment_status: draft.payment_status,
      line_items: items,
    };
  }

  function commitSave(values: UpdateInvoiceInput) {
    if (!invoice) return;
    updateInvoice(
      { invoiceId: invoice.invoice_id, values },
      {
        onSuccess: () => {
          setIsEditing(false);
          setPendingSave(null);
          // The invoices query will be invalidated in data hook on success.
        },
      },
    );
  }

  function handleSave() {
    const values = buildValues();
    if (!values || !invoice) return;

    // Diff the NORMALISED payload, not the raw draft: buildValues trims
    // descriptions and coerces prices to numbers, so comparing the raw draft
    // would report whitespace and "1200" vs 1200 as changes and prompt on a
    // no-op save.
    const changes = isPaid
      ? diffInvoice(invoice, { ...invoice, ...values } as PersistedInvoice)
      : [];

    // Nothing actually moved (or the invoice isn't settled) - just save. The
    // confirm only earns its keep when it has something real to show.
    if (changes.length === 0) {
      commitSave(values);
      return;
    }
    setPendingSave({ values, changes });
  }

  function handleWhatsAppSend() {
    if (!invoice?.pdf_url) return;
    const msg = `Hi ${invoice.customer_name},\n\nPlease find your invoice ${invoice.invoice_id}.\nTotal: ${formatINR(invoice.total)}.\nDownload: ${invoice.pdf_url}\n\nThank you.`;

    const wa = whatsAppLink(invoice.customer_phone, msg);
    if (!wa) {
      toast.error("This customer has no usable phone number");
      return;
    }
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  if (!invoice) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3 pr-8">
            <span className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
              {invoice.invoice_id}
            </span>
            <span className="flex items-center gap-2">
              <InvoiceDownloadButton invoiceId={invoice.invoice_id} />
              {invoice.voided && (
                <Badge
                  variant="outline"
                  className="border-destructive text-destructive"
                >
                  Voided
                </Badge>
              )}
              <Badge variant={invoice.payment_status === "paid" ? "default" : "secondary"}>
                {invoiceStatusLabel(invoice)}
              </Badge>
            </span>
          </SheetTitle>
          <SheetDescription>
            Invoice for {invoice.customer_name} • {createdAtText}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {invoice.voided && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              This invoice was voided
              {invoice.voided_by ? ` by ${invoice.voided_by}` : ""}
              {invoice.voided_at
                ? ` on ${format(new Date(invoice.voided_at), "yyyy-MM-dd HH:mm")}`
                : ""}
              .{invoice.void_reason ? ` Reason: ${invoice.void_reason}` : ""}
            </div>
          )}

          {/* Customer */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{invoice.customer_phone}</span>
            </div>
            {invoice.customer_name && (
              <div className="text-sm text-muted-foreground">
                {invoice.customer_name}
              </div>
            )}
            {invoice.customer_id && (
              <div className="text-xs text-muted-foreground pt-1">
                Customer ID: <span className="font-mono">{invoice.customer_id}</span>
              </div>
            )}
          </section>

          <Separator />

          {/* Edit form */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Invoice details
              </h3>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={invoice.voided}
                  onClick={() =>
                    isPaid ? setConfirmEditOpen(true) : setIsEditing(true)
                  }
                >
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isUpdating}
                    onClick={handleSave}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => {
                      setDraft(invoice);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {draft && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Therapist</div>
                    <Input
                      value={safeText(draft.therapist_name)}
                      onChange={(e) => setDraft({ ...draft, therapist_name: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Payment status</div>
                    <Select
                      value={draft.payment_status}
                      onValueChange={(v) =>
                        setDraft({ ...draft, payment_status: v as InvoicePaymentStatus })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Line items</div>

                  {/* Column headers shown once - the labels no longer repeat per row. */}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 px-3 text-xs text-muted-foreground">
                      Description
                    </div>
                    <div className="w-28 px-3 text-xs text-muted-foreground">
                      Price
                    </div>
                    {isEditing && <div className="w-9 shrink-0" aria-hidden />}
                  </div>

                  <div className="space-y-2">
                    {(draft.line_items ?? []).map((li, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          className="flex-1"
                          value={li.description}
                          onChange={(e) =>
                            setLineItem(idx, { description: e.target.value })
                          }
                          disabled={!isEditing}
                        />
                        <Input
                          className="w-28"
                          type="number"
                          min={0}
                          value={Number(li.price) || 0}
                          onChange={(e) =>
                            setLineItem(idx, { price: Math.max(0, Number(e.target.value) || 0) })
                          }
                          disabled={!isEditing}
                        />
                        {isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground"
                            disabled={(draft.line_items ?? []).length <= 1}
                            onClick={() => removeLineItem(idx)}
                            aria-label="Delete line item"
                            title="Delete line item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isEditing && (
                    <Button type="button" variant="outline" onClick={addLineItem}>
                      Add line item
                    </Button>
                  )}
                </div>

                <div className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(
                        (draft.line_items ?? []).reduce(
                          (s, x) => s + (Number(x.price) || 0),
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Advance paid</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(draft.advance_paid ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Balance due</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(draft.balance_due ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* PDF / WhatsApp */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                PDF and WhatsApp
              </div>
            </div>

            {invoice.pdf_url ? (
              <div className="text-xs text-muted-foreground break-all">
                PDF:{" "}
                <a
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {invoice.pdf_url}
                </a>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No PDF yet. Generate to enable WhatsApp sending.
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isGeneratingPdf}
                onClick={() =>
                  generatePdf({
                    invoiceId: invoice.invoice_id,
                    regenerate: !!invoice.pdf_url,
                  })
                }
              >
                {isGeneratingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : invoice.pdf_url ? (
                  "Regenerate PDF"
                ) : (
                  "Generate PDF"
                )}
              </Button>
              <Button
                type="button"
                disabled={!invoice.pdf_url}
                onClick={handleWhatsAppSend}
              >
                Send via WhatsApp
              </Button>
            </div>
          </section>

          {!invoice.voided && (
            <>
              <Separator />
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <Ban className="h-4 w-4" />
                  Void invoice
                </div>
                <p className="text-xs text-muted-foreground">
                  Cancels this invoice - it stays on record for the audit trail
                  but is excluded from live totals. Use for a mistaken or
                  duplicate invoice.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setVoidOpen(true)}
                >
                  Void invoice
                </Button>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void {invoice.invoice_id}?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be marked voided and excluded from totals. This can&apos;t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Reason (optional)"
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isVoiding}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isVoiding}
            onClick={(e) => {
              e.preventDefault();
              voidInvoiceMut(
                { invoiceId: invoice.invoice_id, reason: voidReason.trim() },
                {
                  onSuccess: () => {
                    setVoidOpen(false);
                    setVoidReason("");
                  },
                },
              );
            }}
          >
            {isVoiding ? "Voiding…" : "Void invoice"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Gate 1 - entering edit on a settled invoice. */}
    <AlertDialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This invoice is already paid</AlertDialogTitle>
          <AlertDialogDescription>
            {invoice.customer_name} has a copy showing{" "}
            {formatINR(invoice.total)}. Editing it changes your books and the
            PDF they were sent - only continue if that&apos;s really what you
            mean to do.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              setConfirmEditOpen(false);
              setIsEditing(true);
            }}
          >
            Edit anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Gate 2 - the itemised diff, only ever shown when something really moved. */}
    <AlertDialog
      open={pendingSave !== null}
      onOpenChange={(o) => {
        if (!o) setPendingSave(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change this paid invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            {invoice.invoice_id} is settled. You&apos;re about to change:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {(pendingSave?.changes ?? []).map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex flex-wrap gap-x-1.5">
              <span className="text-muted-foreground">{c.label}</span>
              {c.from && <span className="line-through opacity-60">{c.from}</span>}
              {c.from && c.to && <span className="text-muted-foreground">→</span>}
              {c.to && <span className="font-medium">{c.to}</span>}
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdating}>
            Keep it as it is
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isUpdating}
            onClick={(e) => {
              e.preventDefault();
              if (pendingSave) commitSave(pendingSave.values);
            }}
          >
            {isUpdating ? "Saving…" : "Yes, change it"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

