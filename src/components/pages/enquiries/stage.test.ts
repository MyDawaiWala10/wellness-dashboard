import { describe, expect, it } from "vitest";
import type { EnquiryType } from "@/type/schema";
import { deriveStage, reachedOutPatch } from "./stage";

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

describe("reachedOutPatch", () => {
  const me = { userId: "u1", name: "Manjeet" };

  it("ticking marks reached and claims the lead, but keeps it an enquiry", () => {
    const p = reachedOutPatch(lead({}), true, me);
    expect(p.executiveReachedOut).toBe(true);
    expect(p.reachedOutBy).toEqual(me);
    expect(p.status).toBeUndefined();
  });

  it("unticking a lead an older tick made 'scheduled' (nothing booked) puts it back", () => {
    expect(reachedOutPatch(lead({ status: "scheduled" }), false).status).toBe("enquiry");
  });

  it("unticking never undoes a real booking", () => {
    expect(reachedOutPatch(lead({ status: "scheduled", doctorId: "THR-0004" }), false).status).toBeUndefined();
    expect(
      reachedOutPatch(lead({ status: "scheduled", slot: { date: "2026-10-28", time: "10:30" } } as Partial<EnquiryType>), false).status,
    ).toBeUndefined();
  });

  it("keeps the existing owner", () => {
    const owner = { userId: "u0", name: "Kamran" };
    expect(reachedOutPatch(lead({ reachedOutBy: owner }), true, me).reachedOutBy).toEqual(owner);
  });
});
