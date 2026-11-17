"use server";

import { backendCall } from "@/lib/backend-call";
import type { ApiResponse } from "@/type/api";

/** A therapist's balance with the clinic, all time (WellnessBackend lib/payouts.ts PayoutBalance). */
export type PayoutBalance = {
  doctorId: string;
  doctor: string;
  /** Their cut of done, paid-for sessions. */
  earned: number;
  /** Cash they took from customers, newest first. */
  cash: { enquiryId: string; amount: number; at: string }[];
  cashTotal: number;
  /** Paid to them so far. */
  paid: number;
  /** Cash they handed back. */
  received: number;
  /** earned - cashTotal - paid + received. Negative: they owe the clinic. */
  remaining: number;
};

export type SettlementInput = { doctorId: string; amount: number; direction: "paid" | "received"; note?: string };

export async function getPayoutBalances(): Promise<ApiResponse<PayoutBalance[]>> {
  return backendCall("/api/payouts", { method: "GET" }, "getPayoutBalances");
}

export async function recordSettlement(input: SettlementInput): Promise<ApiResponse<unknown>> {
  return backendCall("/api/payouts/settlements", { method: "POST", body: JSON.stringify(input) }, "recordSettlement");
}
