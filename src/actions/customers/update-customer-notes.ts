"use server";

import { base_url } from "@/constant";
import { fetchWithAuth } from "@/lib/fetchwithauth";
import { ApiResponse } from "@/type/api";
import type { PersistedCustomer } from "@/type/customer-record";

// The server stamps the author, time and kind from the login.
type AddNoteInput = { note: string };

type EditNoteInput = {
  at: string;
  by: string;
  note: string;
};

export async function addCustomerNote(
  customerId: string,
  note: AddNoteInput,
): Promise<ApiResponse<PersistedCustomer>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: { add: note } }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? `Request failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message ?? "Note added",
      data: result.data as PersistedCustomer,
    };
  } catch (err) {
    return { success: false, message: "Network error, please try again" };
  }
}

export async function editCustomerNote(
  customerId: string,
  note: EditNoteInput,
): Promise<ApiResponse<PersistedCustomer>> {
  try {
    const response = await fetchWithAuth(`${base_url}/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: { edit: note } }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return {
        success: false,
        message: result.message ?? `Request failed with status ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message ?? "Note updated",
      data: result.data as PersistedCustomer,
    };
  } catch (err) {
    return { success: false, message: "Network error, please try again" };
  }
}
