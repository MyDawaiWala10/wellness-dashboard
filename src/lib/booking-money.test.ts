import { describe, it, expect } from "vitest";
import { bookingLedger } from "./booking-money";
import type { slotBookingZodType } from "@/type/schema";

function booking(over: Partial<slotBookingZodType> = {}): slotBookingZodType {
  return {
    name: "Test Patient",
    phonenumber: 9999999999,
    typeOfappointment: "home visit",
    ...over,
  } as slotBookingZodType;
}

describe("bookingLedger - discount on the booking line", () => {
  it("reports no discount when originalPrice was never set", () => {
    const { lines, totals } = bookingLedger(booking({ quotedPrice: 1600 }));

    expect(lines[0].original).toBeUndefined();
    expect(totals.subtotal).toBe(1600);
    expect(totals.discount).toBe(0);
    expect(totals.total).toBe(1600);
  });

  it("reports the discount when the list price is higher", () => {
    const { lines, totals } = bookingLedger(
      booking({ quotedPrice: 1600, originalPrice: 2000 }),
    );

    expect(lines[0].original).toBe(2000);
    expect(totals.subtotal).toBe(2000);
    expect(totals.discount).toBe(400);
    expect(totals.total).toBe(1600);
  });

  it("ignores an originalPrice that is not actually higher", () => {
    // This field gets filled in on plenty of undiscounted bookings, so an
    // equal (or lower) value must not render as a discount of zero or less.
    const equal = bookingLedger(booking({ quotedPrice: 1600, originalPrice: 1600 }));
    expect(equal.lines[0].original).toBeUndefined();
    expect(equal.totals.discount).toBe(0);

    const lower = bookingLedger(booking({ quotedPrice: 1600, originalPrice: 900 }));
    expect(lower.lines[0].original).toBeUndefined();
    expect(lower.totals.discount).toBe(0);
  });
});

describe("bookingLedger - add-ons and totals", () => {
  const withAddons = booking({
    quotedPrice: 1000,
    paymentReceived: true,
    recommendedServices: [
      {
        serviceId: "SRV-1",
        serviceName: "Confirmed unpaid addon",
        quotedPrice: 500,
        status: "confirmed",
        recommendedAt: "2026-09-25T10:00:00.000Z",
      },
      {
        serviceId: "SRV-2",
        serviceName: "Confirmed paid addon",
        quotedPrice: 300,
        status: "confirmed",
        paymentCollected: true,
        recommendedAt: "2026-09-25T11:00:00.000Z",
      },
      {
        serviceId: "SRV-3",
        serviceName: "Still awaiting customer",
        quotedPrice: 700,
        status: "pending",
        recommendedAt: "2026-09-25T12:00:00.000Z",
      },
    ],
  } as Partial<slotBookingZodType>);

  it("splits paid, due and pending correctly", () => {
    const { paid, due, totals } = bookingLedger(withAddons);

    // booking 1000 + paid addon 300
    expect(paid).toBe(1300);
    // only the confirmed unpaid addon is owed right now
    expect(due).toBe(500);
    expect(totals.paid).toBe(1300);
    expect(totals.due).toBe(500);
  });

  it("counts pending add-ons in the total but not in what's owed", () => {
    const { totals } = bookingLedger(withAddons);

    // 1000 + 500 + 300 + 700, including the one awaiting the customer
    expect(totals.total).toBe(2500);
    expect(totals.due).toBe(500);
    expect(totals.total).not.toBe(totals.due + totals.paid);
  });

  it("leaves add-ons out of the discount, since they carry no list price", () => {
    const { totals } = bookingLedger(withAddons);

    expect(totals.subtotal).toBe(totals.total);
    expect(totals.discount).toBe(0);
  });
});

describe("bookingLedger - nothing priced yet", () => {
  it("returns an empty ladder rather than zeros that look like a discount", () => {
    const { lines, totals } = bookingLedger(booking());

    expect(lines).toHaveLength(0);
    expect(totals).toEqual({ subtotal: 0, discount: 0, total: 0, paid: 0, due: 0 });
  });
});
