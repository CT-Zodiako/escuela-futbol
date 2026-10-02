import { z } from "zod";

export const monthPattern = /^\d{4}-\d{2}$/;

export const createStudentSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  document: z.string().trim().min(1).optional().or(z.literal("")),
  phone: z.string().trim().min(1).optional().or(z.literal("")),
  activationMonth: z
    .string()
    .regex(monthPattern, "El mes de activación debe tener formato AAAA-MM."),
});

export const monthQuerySchema = z.object({
  month: z.string().regex(monthPattern, "El mes debe tener formato AAAA-MM."),
});

export const dateRangeSchema = z
  .object({
    from: z.string().min(1, "La fecha inicial es obligatoria."),
    to: z.string().min(1, "La fecha final es obligatoria."),
  })
  .refine((value) => new Date(value.from) <= new Date(value.to), {
    message: "La fecha final debe ser posterior o igual a la inicial.",
  });

const conceptSchema = z
  .string({ required_error: "El concepto es obligatorio." })
  .trim()
  .min(1, "El concepto es obligatorio.")
  .max(160, "El concepto es muy largo.");

export const createPaymentSchema = z.object({
  studentId: z.string().uuid("Estudiante inválido."),
  receiptNumber: z
    .number({ invalid_type_error: "El número de comprobante es obligatorio." })
    .int("El número de comprobante debe ser un número entero.")
    .positive("El número de comprobante debe ser mayor a cero."),
  concept: conceptSchema,
  paymentDate: z.string().min(1, "La fecha de pago es obligatoria."),
  amount: z
    .number()
    .int("El valor debe ser un número entero.")
    .positive("No puede ingresar un valor negativo."),
  method: z.string().trim().min(1).default("cash"),
  note: z.string().trim().max(280, "La observación es muy larga.").optional().or(z.literal("")),
});

export const updatePaymentSchema = z.object({
  concept: conceptSchema,
  paymentDate: z.string().min(1, "La fecha de pago es obligatoria."),
  amount: z
    .number()
    .int("El valor debe ser un número entero.")
    .positive("No puede ingresar un valor negativo."),
  method: z.string().trim().min(1).default("cash"),
  note: z.string().trim().max(280, "La observación es muy larga.").optional().or(z.literal("")),
});
