import { describe, expect, it } from "vitest";
import { createPaymentSchema, createStudentSchema, updatePaymentSchema } from "./validation.js";

describe("createStudentSchema", () => {
  it("accepts a student with only a required name", () => {
    const result = createStudentSchema.safeParse({
      name: "Ana Pérez",
      activationMonth: "2026-09",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a student without a name", () => {
    const result = createStudentSchema.safeParse({
      name: "",
      activationMonth: "2026-09",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an activation month with the wrong format", () => {
    const result = createStudentSchema.safeParse({
      name: "Ana Pérez",
      activationMonth: "09-2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPaymentSchema", () => {
  const base = {
    studentId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
    paymentDate: "2026-09-05",
    method: "cash",
  };

  it("accepts a valid positive integer amount", () => {
    const result = createPaymentSchema.safeParse({ ...base, amount: 50000 });
    expect(result.success).toBe(true);
  });

  it("accepts an optional note", () => {
    const result = createPaymentSchema.safeParse({
      ...base,
      amount: 50000,
      note: "Pago adelantado de octubre",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a payment without a note", () => {
    const result = createPaymentSchema.safeParse({ ...base, amount: 50000 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = createPaymentSchema.safeParse({ ...base, amount: -1000 });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = createPaymentSchema.safeParse({ ...base, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    const result = createPaymentSchema.safeParse({ ...base, amount: 50000.5 });
    expect(result.success).toBe(false);
  });
});

describe("updatePaymentSchema", () => {
  const base = {
    paymentDate: "2026-09-05",
    method: "cash",
  };

  it("accepts a valid edit", () => {
    const result = updatePaymentSchema.safeParse({ ...base, amount: 60000, note: "Corregido" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = updatePaymentSchema.safeParse({ ...base, amount: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = updatePaymentSchema.safeParse({ ...base, amount: 0 });
    expect(result.success).toBe(false);
  });
});
