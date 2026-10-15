import { describe, it, expect } from "vitest";
import { genderLabel, personAge } from "./person";

describe("person", () => {
  const today = new Date(2026, 9, 16); // 16 Oct 2026

  it("an exact date of birth wins over a birth year, counting the birthday", () => {
    expect(personAge({ dob: "1996-12-01", birthYear: 1990 }, today)).toBe(29);
    expect(personAge({ dob: "1996-10-16" }, today)).toBe(30);
    expect(personAge({ birthYear: 1996 }, today)).toBe(30);
    expect(personAge(undefined, today)).toBeUndefined();
  });

  it("labels a stored gender", () => {
    expect(genderLabel("female")).toBe("Female");
    expect(genderLabel(undefined)).toBe("");
  });
});
