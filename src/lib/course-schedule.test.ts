import { describe, it, expect } from "vitest";
import { courseDayOffset, perWeekLabel } from "./course-schedule";

describe("course schedule", () => {
  it("spreads sessions evenly through each week (same as the server)", () => {
    const offsets = (perWeek: number) => Array.from({ length: 6 }, (_, i) => courseDayOffset(i + 1, perWeek));
    expect(offsets(1)).toEqual([0, 7, 14, 21, 28, 35]);
    expect(offsets(2)).toEqual([0, 3, 7, 10, 14, 17]);
    expect(offsets(3)).toEqual([0, 2, 4, 7, 9, 11]);
    expect(offsets(4)).toEqual([0, 1, 3, 5, 7, 8]);
  });

  it("names the frequencies", () => {
    expect([1, 2, 3, 4].map(perWeekLabel)).toEqual(["Once a week", "Twice a week", "3 times a week", "4 times a week"]);
  });
});
