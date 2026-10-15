export interface CustomerNote {
  at: string;
  by: string;
  userId?: string;
  note: string;
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

