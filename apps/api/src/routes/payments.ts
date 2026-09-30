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

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
    });
    if (!student) {
      return reply.status(404).send({ message: "Estudiante no encontrado." });
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: parsed.data.studentId,
        paymentDate: new Date(parsed.data.paymentDate),
        amount: parsed.data.amount,
        method: parsed.data.method,
        note: parsed.data.note || null,
      },
    });
    return reply.status(201).send(payment);
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
        paymentDate: new Date(parsed.data.paymentDate),
        amount: parsed.data.amount,
        method: parsed.data.method,
        note: parsed.data.note || null,
      },
    });
    return reply.send(payment);
  });
}
