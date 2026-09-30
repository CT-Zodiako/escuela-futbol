import { describe, expect, it } from "vitest";
import { monthRange } from "./month.js";

describe("monthRange", () => {
  it("computes the first and last instant of a 31-day month", () => {
    const { start, end } = monthRange("2026-09");
    expect(start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("computes the correct end date for February in a leap year", () => {
    const { end } = monthRange("2028-02");
    expect(end.getUTCDate()).toBe(29);
  });

  it("computes the correct end date for February in a non-leap year", () => {
    const { end } = monthRange("2026-02");
    expect(end.getUTCDate()).toBe(28);
  });
});
