import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { dateRangeSchema, monthQuerySchema } from "../validation.js";
import { monthRange } from "../month.js";

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    await request.jwtVerify().catch(() => reply.status(401).send({ message: "No autorizado." }));
  });

  app.get("/api/reports/summary", async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Rango de fechas inválido.",
      });
    }

    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    to.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: from, lte: to } },
      select: {
        amount: true,
        studentId: true,
        student: { select: { name: true } },
      },
    });

    const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);

    const totalsByStudent = new Map<string, { name: string; total: number }>();
    for (const payment of payments) {
      const existing = totalsByStudent.get(payment.studentId);
      if (existing) {
        existing.total += payment.amount;
      } else {
        totalsByStudent.set(payment.studentId, {
          name: payment.student.name,
          total: payment.amount,
        });
      }
    }

    const paidStudents = Array.from(totalsByStudent.entries())
      .map(([studentId, value]) => ({
        studentId,
        name: value.name,
        totalPaid: value.total,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return {
      totalCollected,
      studentsPaidCount: paidStudents.length,
      paymentsCount: payments.length,
      paidStudents,
    };
  });

  app.get("/api/reports/pending", async (request, reply) => {
    const parsed = monthQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Mes inválido.",
      });
    }

    const { month } = parsed.data;
    const { start, end } = monthRange(month);

    const students = await prisma.student.findMany({
      where: { isActive: true, activationMonth: { lte: month } },
      orderBy: { name: "asc" },
    });

    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      select: { studentId: true },
    });
    const paidStudentIds = new Set(payments.map((payment) => payment.studentId));

    const results = students.map((student) => ({
      studentId: student.id,
      name: student.name,
      status: paidStudentIds.has(student.id) ? "paid" : "pending",
    }));

    return {
      month,
      paidCount: results.filter((r) => r.status === "paid").length,
      pendingCount: results.filter((r) => r.status === "pending").length,
      students: results,
    };
  });

  app.get("/api/reports/export", async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Rango de fechas inválido.",
      });
    }

    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    to.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: from, lte: to } },
      orderBy: { paymentDate: "asc" },
      select: {
        paymentDate: true,
        amount: true,
        method: true,
        note: true,
        student: { select: { name: true, document: true } },
      },
    });

    const header = "Estudiante;Documento;Fecha de pago;Valor;Método;Observación";
    const rows = payments.map((payment) => {
      const date = payment.paymentDate.toISOString().slice(0, 10).split("-").reverse().join("/");
      const method = payment.method === "cash" ? "Efectivo" : payment.method;
      const note = (payment.note ?? "").replace(/;/g, ",");
      return [payment.student.name, payment.student.document ?? "", date, payment.amount, method, note].join(";");
    });
    const csv = [header, ...rows].join("\n");

    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="pagos-${parsed.data.from}-a-${parsed.data.to}.csv"`);
    return reply.send(csv);
  });
}
