import { describe, expect, it } from "vitest";
import { markOwnBooking, newBookingsOf } from "./own-bookings";

type R = { _id: string; parent?: string };
const parentOf = (r: R) => r.parent;

describe("newBookingsOf", () => {
  it("a 6-session package is one booking with +5 visits", () => {
    const fresh: R[] = [{ _id: "p" }, ...[2, 3, 4, 5, 6].map((n) => ({ _id: `s${n}`, parent: "p" }))];
    expect(newBookingsOf(fresh, parentOf)).toEqual([{ rec: { _id: "p" }, visits: 5 }]);
  });

  it("separate bookings each count; a later visit of an older booking stands alone", () => {
    const fresh: R[] = [{ _id: "a" }, { _id: "b" }, { _id: "addon", parent: "old" }];
    expect(newBookingsOf(fresh, parentOf).map((b) => b.rec._id)).toEqual(["a", "b", "addon"]);
  });

  it("skips a booking this tab created, and its sessions", () => {
    markOwnBooking({ _id: "mine" });
    const fresh: R[] = [{ _id: "mine" }, { _id: "m2", parent: "mine" }, { _id: "other" }];
    expect(newBookingsOf(fresh, parentOf).map((b) => b.rec._id)).toEqual(["other"]);
  });
});
