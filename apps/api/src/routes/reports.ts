import type { FastifyInstance } from "fastify";
import ExcelJS from "exceljs";
import { prisma } from "../db.js";
import { dateRangeSchema, monthQuerySchema, reportYearSchema } from "../validation.js";
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
      where: {
        paymentDate: { gte: from, lte: to },
        ...(parsed.data.trainerId ? { student: { trainerId: parsed.data.trainerId } } : {}),
      },
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

  app.get("/api/reports/general", async (request, reply) => {
    const parsed = reportYearSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Año inválido.",
      });
    }

    const year = Number(parsed.data.year);
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const students = await prisma.student.findMany({
      where: parsed.data.trainerId ? { trainerId: parsed.data.trainerId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const payments = await prisma.payment.findMany({
      where: {
        paymentDate: { gte: from, lt: to },
        ...(parsed.data.trainerId ? { student: { trainerId: parsed.data.trainerId } } : {}),
      },
      select: { studentId: true, paymentDate: true, amount: true },
    });

    const byStudent = new Map<string, number[]>();
    for (const student of students) byStudent.set(student.id, Array(12).fill(0));
    for (const payment of payments) {
      const months = byStudent.get(payment.studentId);
      if (!months) continue;
      months[payment.paymentDate.getUTCMonth()] += payment.amount;
    }
    const monthlyTotals = Array(12).fill(0) as number[];
    const rows = students.map((student) => {
      const months = byStudent.get(student.id)!;
      months.forEach((amount, index) => { monthlyTotals[index] += amount; });
      return { studentId: student.id, name: student.name, months, totalPaid: months.reduce((sum, amount) => sum + amount, 0) };
    });
    return { year, students: rows, monthlyTotals, totalCollected: monthlyTotals.reduce((sum, amount) => sum + amount, 0) };
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

  app.get("/api/reports/general/export", async (request, reply) => {
    const parsed = reportYearSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Año inválido." });
    }
    const year = Number(parsed.data.year);
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const [students, payments] = await Promise.all([
      prisma.student.findMany({
        where: parsed.data.trainerId ? { trainerId: parsed.data.trainerId } : undefined,
        orderBy: { name: "asc" }, select: { id: true, name: true },
      }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: from, lt: to }, ...(parsed.data.trainerId ? { student: { trainerId: parsed.data.trainerId } } : {}) },
        select: { studentId: true, paymentDate: true, amount: true },
      }),
    ]);
    const totals = new Map<string, number[]>();
    students.forEach((student) => totals.set(student.id, Array(12).fill(0)));
    payments.forEach((payment) => totals.get(payment.studentId)?.splice(payment.paymentDate.getUTCMonth(), 1, (totals.get(payment.studentId)?.[payment.paymentDate.getUTCMonth()] ?? 0) + payment.amount));
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Informe general");
    worksheet.addRow(["Jugador", ...monthNames, "Total pagado"]);
    worksheet.getRow(1).font = { bold: true };
    const monthlyTotals = Array(12).fill(0) as number[];
    for (const student of students) {
      const months = totals.get(student.id)!;
      months.forEach((amount, index) => { monthlyTotals[index] += amount; });
      worksheet.addRow([student.name, ...months, months.reduce((sum, amount) => sum + amount, 0)]);
    }
    worksheet.addRow(["TOTAL POR MES", ...monthlyTotals, monthlyTotals.reduce((sum, amount) => sum + amount, 0)]);
    worksheet.getRow(worksheet.rowCount).font = { bold: true };
    worksheet.columns = [{ width: 30 }, ...monthNames.map(() => ({ width: 14 })), { width: 16 }];
    const buffer = await workbook.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="informe-general-${year}.xlsx"`);
    return reply.send(Buffer.from(buffer));
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
      where: {
        paymentDate: { gte: from, lte: to },
        ...(parsed.data.trainerId ? { student: { trainerId: parsed.data.trainerId } } : {}),
      },
      orderBy: { paymentDate: "asc" },
      select: {
        paymentDate: true,
        amount: true,
        method: true,
        note: true,
        student: { select: { name: true, document: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Pagos");
    worksheet.addRow(["Estudiante", "Documento", "Fecha de pago", "Valor", "Método", "Observación"]);
    worksheet.getRow(1).font = { bold: true };

    for (const payment of payments) {
      const date = payment.paymentDate.toISOString().slice(0, 10).split("-").reverse().join("/");
      const method = payment.method === "cash" ? "Efectivo" : payment.method;
      worksheet.addRow([
        payment.student.name,
        payment.student.document ?? "",
        date,
        payment.amount,
        method,
        payment.note ?? "",
      ]);
    }

    worksheet.columns = [
      { width: 32 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 40 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    reply.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    reply.header(
      "Content-Disposition",
      `attachment; filename="pagos-${parsed.data.from}-a-${parsed.data.to}.xlsx"`,
    );
    return reply.send(Buffer.from(buffer));
  });
}
