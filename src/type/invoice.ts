export type InvoiceType =
  | "package_purchase"
  | "therapy_session"
  | "therapy_addon_standalone"
  | "online_consultation"
  | "vitals_subscription"; // reserved (not shown in UI)

export type InvoicePaymentStatus = "paid" | "pending";

export interface InvoiceLineItem {
  description: string;
  price: number;
}

export interface PersistedInvoice {
  invoice_id: string;
  invoice_type: InvoiceType;
  appointment_id?: string | null;
  enquiry_id?: string;

  customer_id: string;
  customer_name: string;
  customer_phone: number;

  package_type: "standard" | "custom" | null;
  package_ref: string | null;
  package_name: string;
  session_number: string | null;

  therapist_name: string;

  line_items: InvoiceLineItem[];
  items_subtotal: number;
  advance_paid: number;
  balance_due: number;
  total: number;

  payment_status: InvoicePaymentStatus;

  voided?: boolean;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string;

  createdAt?: string;
  updatedAt?: string;
}

export type UpdateInvoiceInput = {
  therapist_name?: string;
  session_number?: string | null;
  package_type?: "standard" | "custom" | null;
  package_ref?: string | null;
  package_name?: string;
  payment_status?: InvoicePaymentStatus;
  line_items?: InvoiceLineItem[];
};

export type CreateInvoiceInput = {
  invoice_type: InvoiceType;
  customer_name: string;
  customer_phone: number;
  customer_id?: string;
  enquiry_id?: string;
  appointment_id?: string;
  therapist_name?: string;
  line_items: InvoiceLineItem[];
  advance_paid?: number;
  payment_status?: InvoicePaymentStatus;
};

