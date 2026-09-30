import { describe, expect, it } from "vitest";
import { dateRangeSchema } from "./validation.js";

function aggregate(payments: { amount: number; studentId: string }[]) {
  const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const studentsPaidCount = new Set(payments.map((payment) => payment.studentId)).size;
  return { totalCollected, studentsPaidCount, paymentsCount: payments.length };
}

describe("report aggregation", () => {
  it("sums amounts and counts distinct students across multiple payments", () => {
    const result = aggregate([
      { amount: 50000, studentId: "a" },
      { amount: 75000, studentId: "a" },
      { amount: 50000, studentId: "b" },
    ]);
    expect(result.totalCollected).toBe(175000);
    expect(result.studentsPaidCount).toBe(2);
    expect(result.paymentsCount).toBe(3);
  });

  it("returns zero totals for an empty period", () => {
    const result = aggregate([]);
    expect(result.totalCollected).toBe(0);
    expect(result.studentsPaidCount).toBe(0);
    expect(result.paymentsCount).toBe(0);
  });
});

describe("dateRangeSchema", () => {
  it("accepts a valid range", () => {
    const result = dateRangeSchema.safeParse({ from: "2026-09-01", to: "2026-09-30" });
    expect(result.success).toBe(true);
  });

  it("accepts a same-day range", () => {
    const result = dateRangeSchema.safeParse({ from: "2026-09-15", to: "2026-09-15" });
    expect(result.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = dateRangeSchema.safeParse({ from: "2026-09-30", to: "2026-09-01" });
    expect(result.success).toBe(false);
  });
});
