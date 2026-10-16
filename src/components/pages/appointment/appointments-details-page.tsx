"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { slotBookingZodSchema, slotBookingZodType } from "@/type/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useUpdateAppointment } from "@/data/appointment/appointment";
import { useAuthStore } from "@/providers/permission-provider";
import { toast } from "sonner";
import z from "zod";
import { firstBookableDay } from "@/lib/booking-conflicts";

interface AppointmentDetailsPageProps {
  data: slotBookingZodType;
  onClose: () => void;
  /** Hides the visit date/time when a course's own scheduler already manages it. */
  compact?: boolean;
}

export default function AppointmentDetailsPage({
  data,
  onClose,
  compact = false,
}: AppointmentDetailsPageProps) {
  const { user } = useAuthStore();
  const isTherapist = user?.role === "THERAPIST";
  const { mutate: updateMutate, isPending: isUpdating } =
    useUpdateAppointment();
  // Cancelling is a soft status change (kept silent so we can show our own
  // "cancelled" toast). The record, add-ons, sessions and customer details are
  // all preserved; only the status flips to "cancelled".
  const { mutate: cancelMutate, isPending: isCancelling } =
    useUpdateAppointment({ silent: true });

  // Customer identity is set during the enquiry funnel and rarely edited during
  // a visit - keep it tucked away so the drawer stays visit-focused.
  const [showCustomer, setShowCustomer] = useState(false);

  const form = useForm<z.infer<typeof slotBookingZodSchema>>({
    resolver: zodResolver(slotBookingZodSchema),
    defaultValues: buildDefaults(data),
  });

  useEffect(() => {
    form.reset(buildDefaults(data));
  }, [data._id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: slotBookingZodType) {
    updateMutate(values, {
      onSuccess: () => onClose(),
    });
  }

  function handleCancelAppointment() {
    if (!data._id) return;
    cancelMutate(
      { ...form.getValues(), status: "cancelled" },
      {
        onSuccess: () => {
          toast.success("Appointment cancelled", {
            description: "It's kept on record with all its details.",
          });
          onClose();
        },
      },
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Visit-focused details - customer identity is collapsed below. */}
        <div className="w-full mx-auto p-6 border rounded-lg space-y-5 [&>*]:min-w-0">
          {data.doctor && (
            <div>
              <p className="text-sm font-medium">Therapist</p>
              <p className="mt-1 text-sm text-muted-foreground">{data.doctor}</p>
            </div>
          )}

          {/* Visit date/time only when there's no package block managing it.
              Therapists cannot reschedule - only admins/staff can. */}
          {!compact && !isTherapist && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="slot.date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} min={firstBookableDay()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slot.time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input placeholder="Time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* The note is edited on the Visit tab, beside the work it describes.
              Deliberately not repeated here: two editors on one field diverge. */}

          {/* Customer details - collapsed by default. */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowCustomer((s) => !s)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showCustomer ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Customer details
            </button>

            {/* Therapists see the details (address, phone for the visit) but
                never change them; the backend drops their edits too. */}
            {showCustomer && (
              <fieldset
                disabled={isTherapist}
                className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4 mt-3"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Name" {...field} />
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
                        <PhoneInput {...field} placeholder="Phone Number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Location" {...field} />
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
                        <Input placeholder="Age" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>
            )}
          </div>
        </div>

        {/* Actions sit under the fields they act on. A therapist has none here:
            no reschedule, no customer edits, and only the office cancels. */}
        {!isTherapist && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground"
                  disabled={isCancelling || isUpdating}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel appointment"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It will be marked as cancelled and kept on record. Sessions,
                    add-ons, and customer details all stay saved. It won&apos;t be
                    deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancelAppointment}>
                    Cancel appointment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button type="submit" size="sm" disabled={isUpdating || isCancelling}>
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}

// Preserve every field on the record (including ones no longer shown in this
// drawer - therapist id, appointment type, package id, therapy start/end times)
// so an "Update Details" save never silently wipes them.
function buildDefaults(data: slotBookingZodType) {
  return {
    _id: data._id,
    name: data.name,
    location: data.location,
    category: data.category,
    slot: {
      date: data.slot?.date
        ? new Date(data.slot.date).toISOString().split("T")[0]
        : "",
      time: data.slot?.time ?? "",
    },
    note: data.note,
    age: data.age,
    phonenumber: data.phonenumber,
    email: data.email,
    doctor: data.doctor,
    doctorId: data.doctorId,
    status: data.status ?? "scheduled",
    therapyStartTime: data.therapyStartTime ?? "",
    therapyEndTime: data.therapyEndTime ?? "",
    typeOfappointment: data.typeOfappointment ?? "appointment",
    packageServiceId: data.packageServiceId ?? "",
  };
}
