import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { createPaymentSchema, updatePaymentSchema } from "../validation.js";

export async function paymentRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    await request.jwtVerify().catch(() => reply.status(401).send({ message: "No autorizado." }));
  });

  app.get("/api/payments", async (request) => {
    const query = request.query as { studentId?: string };
    return prisma.payment.findMany({
      where: query.studentId ? { studentId: query.studentId } : undefined,
      orderBy: { paymentDate: "desc" },
    });
  });

  app.post("/api/payments", async (request, reply) => {
    const parsed = createPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize allocation AND deduplication across all API processes. The counter
      // increment rolls back with the payment; retries never consume a receipt.
      await tx.$queryRaw`SELECT "id" FROM "receipt_counter" WHERE "id" = 1 FOR UPDATE`;
      if (parsed.data.clientMutationId) {
        const existing = await tx.payment.findUnique({
          where: { clientMutationId: parsed.data.clientMutationId },
        });
        if (existing) return { status: 200, body: existing };
      }
      const student = await tx.student.findUnique({ where: { id: parsed.data.studentId } });
      if (!student) return { status: 404, body: { message: "Estudiante no encontrado." } };

      // One payment per student per calendar month; the paymentDate month is
      // the covered month. The counter is not touched on a duplicate.
      const [year, month] = parsed.data.paymentDate.split("-").map(Number);
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonthStart = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const duplicate = await tx.payment.findFirst({
        where: {
          studentId: parsed.data.studentId,
          paymentDate: { gte: new Date(monthStart), lt: new Date(nextMonthStart) },
        },
      });
      if (duplicate) {
        return { status: 409, body: { message: "El estudiante ya tiene un pago registrado en ese mes." } };
      }

      const [counter] = await tx.$queryRaw<{ value: number }[]>`
        UPDATE "receipt_counter" SET "value" = "value" + 1 WHERE "id" = 1 RETURNING "value"`;
      if (!counter) throw new Error("Receipt counter is missing");
      const payment = await tx.payment.create({
        data: {
          studentId: parsed.data.studentId,
          clientMutationId: parsed.data.clientMutationId,
          receiptNumber: counter.value,
          concept: parsed.data.concept,
          paymentDate: new Date(parsed.data.paymentDate),
          amount: parsed.data.amount,
          method: parsed.data.method,
          note: parsed.data.note || null,
        },
      });
      return { status: 201, body: payment };
    }, { isolationLevel: "ReadCommitted" });
    return reply.status(result.status).send(result.body);
  });

  app.put("/api/payments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      });
    }

    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ message: "Pago no encontrado." });
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        concept: parsed.data.concept,
        paymentDate: new Date(parsed.data.paymentDate),
        amount: parsed.data.amount,
        method: parsed.data.method,
        note: parsed.data.note || null,
      },
    });
    return reply.send(payment);
  });
}
