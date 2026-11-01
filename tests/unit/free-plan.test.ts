import { describe, expect, it } from "vitest";
import { allowanceFrom, monthBounds } from "@/modules/explore/limits";

describe("the free plan's deep searches", () => {
  it("allows one a month, and one more after sharing feedback", () => {
    expect(allowanceFrom(0, false, false, "x")).toMatchObject({ max: 1, left: 1, bonusAvailable: true });
    expect(allowanceFrom(1, false, false, "x")).toMatchObject({ max: 1, left: 0, bonusAvailable: true });
    expect(allowanceFrom(1, true, false, "x")).toMatchObject({ max: 2, left: 1, bonusAvailable: false });
    expect(allowanceFrom(2, true, false, "x")).toMatchObject({ left: 0 });
    expect(allowanceFrom(5, false, true, "x")).toMatchObject({ unlimited: true });
  });

  it("resets on the first of the next month", () => {
    expect(monthBounds(new Date("2026-11-30T23:59:00Z"))).toEqual({ start: "2026-11-01T00:00:00.000Z", next: "2026-12-01T00:00:00.000Z" });
    expect(monthBounds(new Date("2026-12-15T10:00:00Z")).next).toBe("2027-01-01T00:00:00.000Z");
  });
});
