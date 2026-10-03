import { describe, expect, it } from "vitest";
import { createPaymentSchema, createStudentSchema, updatePaymentSchema } from "./validation.js";

describe("createStudentSchema", () => {
  it("accepts a student with a required name and trainer", () => {
    const result = createStudentSchema.safeParse({
      name: "Ana Pérez",
      trainerId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
      activationMonth: "2026-09",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a student without a name", () => {
    const result = createStudentSchema.safeParse({
      name: "",
      trainerId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
      activationMonth: "2026-09",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an activation month with the wrong format", () => {
    const result = createStudentSchema.safeParse({
      name: "Ana Pérez",
      trainerId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
      activationMonth: "09-2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPaymentSchema", () => {
  const base = {
    studentId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
    receiptNumber: 1116,
    concept: "Mensualidad octubre",
    paymentDate: "2026-09-05",
    method: "cash",
  };

  it("accepts server numbering and validates optional legacy receipt numbers", () => {
    const { receiptNumber: _omit, ...without } = base;
    expect(createPaymentSchema.safeParse({ ...without, amount: 50000 }).success).toBe(true);
    expect(createPaymentSchema.safeParse({ ...base, receiptNumber: 0, amount: 50000 }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, receiptNumber: 1.5, amount: 50000 }).success).toBe(false);
  });

  it("validates mutation UUIDs and payment dates before writing", () => {
    expect(createPaymentSchema.safeParse({ ...base, amount: 1, clientMutationId: "invalid" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, amount: 1, paymentDate: "invalid" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, amount: 2147483648 }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, amount: 1,
      clientMutationId: "c3f1a2c4-1111-4b2b-9c3d-1234567890ab" }).success).toBe(true);
  });

  it("requires a non-empty concept", () => {
    const { concept: _omit, ...without } = base;
    expect(createPaymentSchema.safeParse({ ...without, amount: 50000 }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, concept: "   ", amount: 50000 }).success).toBe(false);
  });

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
  it("does not carry a receipt number through", () => {
    const result = updatePaymentSchema.safeParse({
      concept: "Mensualidad",
      paymentDate: "2026-09-05",
      amount: 1000,
      receiptNumber: 5,
    });
    expect(result.success && "receiptNumber" in result.data).toBe(false);
  });

  const base = {
    concept: "Mensualidad",
    paymentDate: "2026-09-05",
    method: "cash",
  };

  it("requires a concept and allows editing it", () => {
    expect(updatePaymentSchema.safeParse({ ...base, amount: 1000, concept: "" }).success).toBe(false);
    const { concept: _omit, ...without } = base;
    expect(updatePaymentSchema.safeParse({ ...without, amount: 1000 }).success).toBe(false);
    const edited = updatePaymentSchema.safeParse({ ...base, amount: 1000, concept: "  Uniforme  " });
    expect(edited.success && edited.data.concept).toBe("Uniforme");
  });

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
