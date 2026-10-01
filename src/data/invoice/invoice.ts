"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  InvoicePaymentStatus,
  PersistedInvoice,
  UpdateInvoiceInput,
  CreateInvoiceInput,
} from "@/type/invoice";
import { getAllInvoices } from "@/actions/invoices/get-all-invoices";
import updateInvoice from "@/actions/invoices/update-invoice";
import generateInvoicePdf from "@/actions/invoices/generate-invoice-pdf";
import createInvoice from "@/actions/invoices/create-invoice";
import voidInvoice from "@/actions/invoices/void-invoice";

export function useGetInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<PersistedInvoice[]> => {
      const result = await getAllInvoices();
      if (!result.success) throw new Error(result.message);
      return (result.data ?? []) as PersistedInvoice[];
    },
    refetchOnWindowFocus: false,
  });
}

/**
 * The one invoice belonging to a booking, or null when it hasn't been raised
 * yet. Therapists are 403'd from every invoice route, so callers must not
 * mount this for them - `enabled` is the guard.
 */
export function useInvoiceForAppointment(
  appointmentId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["invoices", "by-appointment", appointmentId],
    enabled: Boolean(appointmentId) && options?.enabled !== false,
    queryFn: async (): Promise<PersistedInvoice | null> => {
      const result = await getAllInvoices({ appointmentId });
      if (!result.success) throw new Error(result.message);
      // Never trust the server to have filtered. An older backend ignores the
      // unknown appointment_id param and hands back the 100 most recent
      // invoices, and taking [0] there would pin a stranger's invoice to this
      // booking. Matching locally degrades to "no invoice" instead.
      return (
        (result.data ?? []).find((i) => i.appointment_id === appointmentId) ?? null
      );
    },
    refetchOnWindowFocus: false,
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { invoiceId: string; values: UpdateInvoiceInput }) => {
      const result = await updateInvoice(args.invoiceId, args.values);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invoice updated");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateInvoicePdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      regenerate = false,
    }: {
      invoiceId: string;
      regenerate?: boolean;
    }) => {
      const result = await generateInvoicePdf(invoiceId, { regenerate });
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.regenerate ? "Invoice PDF regenerated" : "Invoice PDF generated");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVoidInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { invoiceId: string; reason: string }) => {
      const result = await voidInvoice(args.invoiceId, args.reason);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invoice voided");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreateInvoiceInput) => {
      const result = await createInvoice(values);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invoice created");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

