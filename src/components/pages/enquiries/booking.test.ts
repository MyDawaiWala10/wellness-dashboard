import { describe, expect, it } from "vitest";
import { bookingKindOf, bookingLabel } from "./booking";

describe("bookingKindOf", () => {
  it("prefers the stored kind", () => {
    expect(bookingKindOf({ bookingKind: "course" })).toBe("course");
    // Stored wins even when the session count would say otherwise.
    expect(bookingKindOf({ bookingKind: "intake", totalSessions: 6 })).toBe(
      "intake",
    );
  });

  it("falls back to the session count when the field is missing", () => {
    // The backend model drops unknown fields, and records predate the field, so
    // without this fallback every course would read back as an intake.
    expect(bookingKindOf({ totalSessions: 6 })).toBe("course");
    expect(bookingKindOf({ totalSessions: 1 })).toBe("course");
    expect(bookingKindOf({})).toBe("intake");
    expect(bookingKindOf({ totalSessions: 0 })).toBe("intake");
  });
});

describe("bookingLabel", () => {
  it("labels intakes by delivery mode", () => {
    expect(bookingLabel({ bookingKind: "intake", typeOfappointment: "consultation" }))
      .toBe("Online consultation");
    expect(bookingLabel({ bookingKind: "intake", typeOfappointment: "appointment" }))
      .toBe("Home visit");
  });

  it("never labels a course with an intake type", () => {
    // The original bug: a course is always delivered at home, so it carried
    // typeOfappointment "appointment" and rendered as "Home visit".
    const course = {
      bookingKind: "course" as const,
      totalSessions: 6,
      typeOfappointment: "appointment" as const,
    };
    expect(bookingLabel(course)).toBe("Therapy package (6 sessions)");
    expect(bookingLabel({ ...course, totalSessions: 1 })).toBe("Therapy session");
  });

  it("falls back to a sane label when the type is missing", () => {
    expect(bookingLabel({})).toBe("Consultation");
  });
});
