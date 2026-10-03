import { describe, it, expect } from "vitest";
import {
  BOOKING_SOURCES,
  bookingSource,
  bookingSourceError,
  bookingSourceMeta,
} from "./booking-source";

describe("bookingSource", () => {
  it("passes each current source straight through", () => {
    for (const { value } of BOOKING_SOURCES) {
      expect(bookingSource({ source: value })).toBe(value);
    }
  });

  it("reads old website bookings as Online", () => {
    expect(bookingSource({ source: "public_booking_form" })).toBe("online");
  });

  it("reads old staff-entered bookings as WhatsApp", () => {
    expect(bookingSource({ source: "dashboard" })).toBe("whatsapp");
  });

  it("reads a missing source as WhatsApp", () => {
    expect(bookingSource({})).toBe("whatsapp");
    expect(bookingSource({ source: null })).toBe("whatsapp");
    expect(bookingSource({ source: "" })).toBe("whatsapp");
  });

  it("never throws on an unknown value", () => {
    expect(bookingSource({ source: "instagram" })).toBe("whatsapp");
  });
});

describe("bookingSourceError", () => {
  it("requires a pick, since there's no default", () => {
    expect(bookingSourceError({})).toBeTruthy();
    expect(bookingSourceError({ source: "" })).toBeTruthy();
  });

  it("requires the referring therapist for a therapist referral", () => {
    expect(bookingSourceError({ source: "therapist" })).toBeTruthy();
    expect(bookingSourceError({ source: "therapist", referredByDoctorId: null })).toBeTruthy();
    expect(
      bookingSourceError({ source: "therapist", referredByDoctorId: "THR-0001" }),
    ).toBeUndefined();
  });

  it("accepts the other sources on their own", () => {
    for (const source of ["online", "whatsapp", "walk_in"] as const) {
      expect(bookingSourceError({ source })).toBeUndefined();
    }
  });
});

describe("bookingSourceMeta", () => {
  it("gives every source a label and a pill colour", () => {
    for (const { value } of BOOKING_SOURCES) {
      const meta = bookingSourceMeta(value);
      expect(meta.label).toBeTruthy();
      expect(meta.className).toMatch(/bg-/);
    }
  });
});
