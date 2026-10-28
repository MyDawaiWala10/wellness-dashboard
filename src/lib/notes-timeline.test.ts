import { describe, expect, it } from "vitest";
import type { slotBookingZodType as Row } from "@/type/schema";
import type { CustomerNote } from "@/type/customer-record";
import { buildNotesTimeline, canEditNote } from "./notes-timeline";

const row = (r: Partial<Row> & { createdAt?: string }) => ({ name: "Asha", phonenumber: 1, ...r }) as Row;

// A returning customer: an older home visit, then a 3-session package.
const visit = row({ _id: "v1", enquiryId: "ENQ-0010", typeOfappointment: "appointment", createdAt: "2026-09-01T10:00:00Z",
  note: "Knee pain", sessionNotes: [{ session: 1, at: "2026-09-02T10:00:00Z", note: "Knee mobilisation", therapist: "Sen" }] as Row["sessionNotes"] });
const pkg = row({ _id: "p1", enquiryId: "ENQ-0020", bookingKind: "course", totalSessions: 3, createdAt: "2026-10-01T10:00:00Z",
  note: "Lower back pain", customerNotes: [{ at: "2026-10-03T10:00:00Z", note: "Now also neck stiffness", repeat: 2 }],
  sessionNotes: [{ session: 1, at: "2026-10-05T10:00:00Z", note: "Dry needling on QL", therapist: "T1234" }] as Row["sessionNotes"] });
const pkgS2 = row({ _id: "p2", enquiryId: "ENQ-0021", packageOriginId: "p1", sessionNumber: 2, totalSessions: 3, createdAt: "2026-10-01T10:00:00Z",
  sessionNotes: [{ session: 2, at: "2026-10-08T10:00:00Z", note: "Neck stretches added", therapist: "T1234" }] as Row["sessionNotes"] });

describe("buildNotesTimeline", () => {
  it("one block per booking, newest first; package sessions stay inside their booking", () => {
    const t = buildNotesTimeline([visit, pkg, pkgS2]);
    expect(t.bookings.map((b) => b.enquiryId)).toEqual(["ENQ-0020", "ENQ-0010"]);
    expect(t.bookings[0].notes.map((n) => [n.source, n.tag, n.text])).toEqual([
      ["customer", "When booking", "Lower back pain"],
      ["customer", "Asked again (#2)", "Now also neck stiffness"],
      ["therapist", "Session 1 of 3", "Dry needling on QL"],
      ["therapist", "Session 2 of 3", "Neck stretches added"],
    ]);
    expect(t.bookings[1].notes.map((n) => n.tag)).toEqual(["When booking", "Session 1"]);
  });

  it("record notes: session copies already shown are dropped; office and therapist notes are about the person", () => {
    const notes: CustomerNote[] = [
      { at: "2026-10-05T10:00:00Z", by: "T1234", note: "Dry needling on QL", kind: "session", enquiryId: "ENQ-0020", session: 1 },
      { at: "2026-09-02T10:00:00Z", by: "Sen", note: "Knee mobilisation" }, // old copy, no kind
      { at: "2026-10-02T10:00:00Z", by: "Manjeet", note: "Prefers a female therapist", kind: "office" },
      { at: "2026-10-04T10:00:00Z", by: "Sen", note: "Diabetic", kind: "therapist" },
      { at: "2026-08-01T10:00:00Z", by: "Kamran", note: "Called twice, no answer" }, // old staff note, no kind
    ];
    const t = buildNotesTimeline([visit, pkg, pkgS2], notes);
    expect(t.about.map((n) => [n.source, n.text])).toEqual([
      ["therapist", "Diabetic"],
      ["office", "Prefers a female therapist"],
      ["office", "Called twice, no answer"],
    ]);
    expect(t.bookings[0].notes.filter((n) => n.source === "therapist")).toHaveLength(2);
  });

  it("a session note from a booking this viewer can't see gets its own block", () => {
    const t = buildNotesTimeline([pkg], [
      { at: "2026-09-02T10:00:00Z", by: "Sen", note: "Knee mobilisation", kind: "session", enquiryId: "ENQ-0010", session: 1 },
    ]);
    expect(t.bookings.map((b) => [b.enquiryId, b.title])).toEqual([["ENQ-0020", "Therapy package (3 sessions)"], ["ENQ-0010", "Earlier visit"]]);
    expect(t.bookings[1].notes[0]).toMatchObject({ source: "therapist", tag: "Session 1", by: "Sen" });
  });

  it("a first-time customer with no notes has empty blocks, not errors", () => {
    const t = buildNotesTimeline([row({ _id: "x", enquiryId: "ENQ-0030" })]);
    expect(t).toEqual({ about: [], bookings: [expect.objectContaining({ enquiryId: "ENQ-0030", notes: [] })] });
  });
});

describe("canEditNote", () => {
  it("author or Admin; never a session's copy", () => {
    const office: CustomerNote = { at: "x", by: "M", note: "n", kind: "office", userId: "u1" };
    expect(canEditNote(office, { role: "STAFF", id: "u1" })).toBe(true);
    expect(canEditNote(office, { role: "STAFF", id: "u2" })).toBe(false);
    expect(canEditNote(office, { role: "ADMIN", id: "u2" })).toBe(true);
    expect(canEditNote({ ...office, kind: "session" }, { role: "SUPER_ADMIN", id: "u1" })).toBe(false);
  });
});
