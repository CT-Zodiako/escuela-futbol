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

    const clientMutationId = parsed.data.clientMutationId?.toLowerCase();
    if (clientMutationId) {
      const existing = await prisma.student.findUnique({ where: { clientMutationId } });
      if (existing) return reply.send(existing);
    }
    try {
      const student = await prisma.student.create({
        data: {
          // Stable IDs let offline payments reference a student before either syncs.
          ...(clientMutationId ? { id: clientMutationId, clientMutationId } : {}),
          name: parsed.data.name,
          document: parsed.data.document || null,
          phone: parsed.data.phone || null,
          activationMonth: parsed.data.activationMonth || currentMonth(),
        },
      });
      return reply.status(201).send(student);
    } catch (error) {
      // The unique index arbitrates concurrent submissions, including lost responses.
      if (clientMutationId && (error as { code?: string }).code === "P2002") {
        const existing = await prisma.student.findUnique({ where: { clientMutationId } });
        if (existing) return reply.send(existing);
      }
      throw error;
    }
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
