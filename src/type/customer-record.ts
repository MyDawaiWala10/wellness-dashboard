export interface CustomerNote {
  at: string;
  by: string;
  userId?: string;
  note: string;
  /** Set by the server; older notes have none (see notes-timeline.ts). */
  kind?: "office" | "therapist" | "session";
  /** For a session's copy: the booking and session it came from. */
  enquiryId?: string;
  session?: number;
}

export interface PersistedCustomer {
  customer_id: string;
  name: string;
  phone: number;
  email?: string;
  address?: string;
  gender?: string;
  birthYear?: number;
  dob?: string;
  notes?: CustomerNote[];

  createdAt?: string;
  updatedAt?: string;
}

export type CreateCustomerInput = {
  name: string;
  phone: number;
  email?: string;
  address?: string;
};

