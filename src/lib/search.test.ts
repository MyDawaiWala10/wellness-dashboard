import { describe, expect, it } from "vitest";
import { matchesSearch } from "./search";

describe("matchesSearch", () => {
  const row = ["Launch Test3", "ENQ-0139", 9865741235, "a@b.com", "therapist1234 -", undefined];
  it("partly matches any field, any case", () => {
    expect(matchesSearch("launch", row)).toBe(true);
    expect(matchesSearch("enq-013", row)).toBe(true);
    expect(matchesSearch("98657", row)).toBe(true);
    expect(matchesSearch("@B.", row)).toBe(true);
    expect(matchesSearch("therap", row)).toBe(true);
  });
  it("empty search matches everything; no match is false", () => {
    expect(matchesSearch("  ", row)).toBe(true);
    expect(matchesSearch("mansi", row)).toBe(false);
  });
});
