import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { createStudentSchema } from "../validation.js";
import { currentMonth } from "../month.js";
import { z } from "zod";

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export async function studentRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    await request.jwtVerify().catch(() => reply.status(401).send({ message: "No autorizado." }));
  });

  app.get("/api/students", async () => {
    return prisma.student.findMany({ orderBy: { name: "asc" } });
  });

  app.post("/api/students", async (request, reply) => {
    const parsed = createStudentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      });
    }

    const student = await prisma.student.create({
      data: {
        name: parsed.data.name,
        document: parsed.data.document || null,
        phone: parsed.data.phone || null,
        activationMonth: parsed.data.activationMonth || currentMonth(),
      },
    });

    return reply.status(201).send(student);
  });

  app.put("/api/students/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos." });
    }

    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ message: "Estudiante no encontrado." });
    }

    const isReactivating = parsed.data.isActive && !existing.isActive;

    const student = await prisma.student.update({
      where: { id },
      data: {
        isActive: parsed.data.isActive,
        ...(isReactivating ? { activationMonth: currentMonth() } : {}),
      },
    });

    return reply.send(student);
  });
}
