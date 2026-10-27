import { describe, expect, it } from "vitest";
import type { EnquiryType } from "@/type/schema";
import { deriveStage } from "./stage";

const lead = (r: Partial<EnquiryType>) => ({ status: "enquiry", ...r }) as EnquiryType;

describe("deriveStage: follow-ups", () => {
  it("a website lead (always has a type) that couldn't be reached is a follow-up", () => {
    expect(deriveStage(lead({ typeOfappointment: "consultation", reachAttempts: 1 }))).toBe("follow_up");
  });

  it("once reached, it leaves follow-ups", () => {
    expect(deriveStage(lead({ typeOfappointment: "consultation", reachAttempts: 2, executiveReachedOut: true }))).toBe("booked");
  });

  it("paid or assigned outranks a missed call", () => {
    expect(deriveStage(lead({ reachAttempts: 1, paymentReceived: true }))).toBe("paid");
  });

  it("no calls tried yet is still a plain enquiry or booked", () => {
    expect(deriveStage(lead({}))).toBe("enquiry");
    expect(deriveStage(lead({ typeOfappointment: "appointment" }))).toBe("booked");
  });
});
