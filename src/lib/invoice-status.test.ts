import { describe, it, expect } from "vitest";
import { invoiceStatusLabel } from "./invoice-status";

describe("invoiceStatusLabel", () => {
  it("reads money already in as Part paid", () => {
    expect(invoiceStatusLabel({ payment_status: "paid", advance_paid: 3000 })).toBe("Paid");
    expect(invoiceStatusLabel({ payment_status: "pending", advance_paid: 1600 })).toBe("Part paid");
    expect(invoiceStatusLabel({ payment_status: "pending", advance_paid: 0 })).toBe("Pending");
  });
});
