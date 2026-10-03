"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CirclePlus, Loader2, TriangleAlert, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useCreateEnquiry, findOpenEnquiryByPhone } from "@/data/enquiry/enquiry";
import { useGetCustomers } from "@/data/customer/customer";
import { useAuthStore } from "@/providers/permission-provider";
import { BookingSourceField } from "@/components/booking-source-field";
import { bookingSourceError, type BookingSource } from "@/lib/booking-source";

const intakeFormSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phonenumber: z
      .number({ error: "Phone is required" })
      .refine((n) => String(n).length === 10, "Phone must be exactly 10 digits"),
    preferredReachOutTime: z
      .object({
        from: z.string().min(1, "Start time is required"),
        to: z.string().min(1, "End time is required"),
      })
      .refine((v) => v.from < v.to, {
        message: "End time must be after start time",
        path: ["to"],
      }),
    note: z.string().optional(),
    source: z.string().optional(),
    referredByDoctorId: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const message = bookingSourceError({
      source: v.source as BookingSource | "",
      referredByDoctorId: v.referredByDoctorId,
    });
    if (message) ctx.addIssue({ code: "custom", message, path: ["source"] });
  });

type IntakeFormValues = z.infer<typeof intakeFormSchema>;

interface EnquiryIntakeModalProps {
  /** Pre-fill fields - used from the Customers drawer for follow-up bookings. */
  prefill?: Partial<IntakeFormValues>;
  triggerLabel?: string;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export function EnquiryIntakeModal({
  prefill,
  triggerLabel = "New Enquiry",
  triggerVariant = "default",
  className,
}: EnquiryIntakeModalProps) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateEnquiry();

  // Known customers, for the duplicate-phone lookup. Only fetched once the
  // modal is open (and reuses the ["customers"] cache the Customers page
  // already fills).
  const user = useAuthStore((s) => s.user);
  const { data: customers } = useGetCustomers(
    { id: user?.id, role: user?.role, userEmail: user?.userEmail },
    { enabled: open && !!user },
  );

  const emptyValues: IntakeFormValues = {
    name: "",
    phonenumber: undefined as unknown as number,
    preferredReachOutTime: { from: "", to: "" },
    note: "",
    // No default on purpose: an untouched pick would file a walk-in as WhatsApp.
    source: "",
    referredByDoctorId: null,
  };

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    mode: "onChange",
    defaultValues: emptyValues,
  });

  // Once the phone is a full 10 digits, match it against known customers.
  const phone = form.watch("phonenumber");
  // Customers are split per person now, so a shared/household number yields
  // several rows. Collect everyone on this number to neither auto-fill the wrong
  // name nor claim a single "returning customer" when it's really a household.
  const peopleOnNumber =
    typeof phone === "number" && String(phone).length === 10
      ? (customers?.filter((c) => c.phonenumber === phone) ?? [])
      : [];
  const namesOnNumber = Array.from(
    new Set(peopleOnNumber.map((c) => c.name.trim()).filter(Boolean)),
  );
  const numberHasMultiplePeople = peopleOnNumber.length > 1;
  // A still-open lead for anyone on this number → a new enquiry may duplicate it.
  const openEnquiry = findOpenEnquiryByPhone(
    peopleOnNumber.flatMap((c) => c.bookings),
    phone as number,
  );

  // Auto-fill only when the number belongs to exactly one known person - never
  // clobber a name the executive already typed (or one carried in via `prefill`),
  // and never guess when the number is shared.
  const matchedName =
    peopleOnNumber.length === 1 ? peopleOnNumber[0].name : undefined;
  useEffect(() => {
    if (matchedName && !form.getValues("name")) {
      form.setValue("name", matchedName, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [matchedName, form]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && prefill) {
      form.reset({ ...emptyValues, ...prefill });
    }
    if (!next) form.reset(emptyValues);
  }

  function onSubmit(values: IntakeFormValues) {
    createMutation.mutate(
      {
        ...values,
        // Only a therapist referral carries a referrer; don't post a stale one.
        referredByDoctorId:
          values.source === "therapist" ? values.referredByDoctorId : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={`flex items-center gap-1 ${className ?? ""}`}
        >
          <CirclePlus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            {triggerLabel}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New enquiry</DialogTitle>
          <DialogDescription>
            Log an inbound lead. You can fill in slots and the assigned
            therapist later from the detail drawer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mt-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
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
                  <FormLabel>Phone number</FormLabel>
                  <FormControl>
                    <PhoneInput {...field} placeholder="10-digit phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {peopleOnNumber.length > 0 &&
              (openEnquiry ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    <strong>{openEnquiry.name ?? "This customer"}</strong> already
                    has an open enquiry
                    {openEnquiry.enquiryId ? ` (${openEnquiry.enquiryId})` : ""} ·{" "}
                    {openEnquiry.status}. You can still log a new one.
                  </span>
                </div>
              ) : numberHasMultiplePeople ? (
                <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                  <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    This number is shared by {namesOnNumber.length} people (
                    {namesOnNumber.join(", ")}). Type the name for this enquiry -
                    we won&apos;t assume which one.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                  <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Returning customer:{" "}
                    <strong>{peopleOnNumber[0].name}</strong> ·{" "}
                    {peopleOnNumber[0].totalBookings} past{" "}
                    {peopleOnNumber[0].totalBookings === 1 ? "booking" : "bookings"}.
                  </span>
                </div>
              ))}

            <div className="space-y-2">
              <FormLabel>Preferred reach-out time</FormLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="preferredReachOutTime.from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        From
                      </FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferredReachOutTime.to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        To
                      </FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When does the client want to be reached? Browser will show
                AM/PM based on your locale.
              </p>
            </div>

            <FormField
              control={form.control}
              name="source"
              render={({ fieldState }) => (
                <FormItem>
                  <FormLabel>How did they reach us?</FormLabel>
                  <BookingSourceField
                    value={{
                      source: (form.watch("source") ?? "") as BookingSource | "",
                      referredByDoctorId: form.watch("referredByDoctorId"),
                    }}
                    onChange={(next) => {
                      form.setValue("referredByDoctorId", next.referredByDoctorId ?? null);
                      form.setValue("source", next.source ?? "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    error={fieldState.error?.message}
                  />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did the lead say?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Read-only IDs - assigned server-side on save */}
            <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enquiry ID</span>
                <span className="font-mono text-muted-foreground">
                  assigned on save
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer ID</span>
                <span className="font-mono text-muted-foreground">
                  linked by phone on save
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </span>
              ) : (
                "Create enquiry"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
