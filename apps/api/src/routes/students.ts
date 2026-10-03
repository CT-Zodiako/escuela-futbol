import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { createStudentSchema } from "../validation.js";
import { currentMonth } from "../month.js";
import { z } from "zod";

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

// Edits are limited to name, trainer, document, and phone: identity, active
// status, activation month, and payment history are never rewritten here.
const updateStudentSchema = z.object({
  trainerId: z.string({ required_error: "Seleccioná un entrenador." }).uuid("Entrenador inválido."),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  document: z
    .string({ required_error: "El documento es obligatorio." })
    .trim()
    .min(1, "El documento es obligatorio.")
    .regex(/^\d+$/, "El documento debe contener solo números, sin puntos ni espacios."),
  phone: z
    .string({ required_error: "El teléfono es obligatorio." })
    .trim()
    .min(1, "El teléfono es obligatorio.")
    .regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos."),
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
    const trainerId = parsed.data.trainerId.toLowerCase();
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) return reply.status(400).send({ message: "Entrenador no encontrado." });
    try {
      const student = await prisma.student.create({
        data: {
          // Stable IDs let offline payments reference a student before either syncs.
          ...(clientMutationId ? { id: clientMutationId, clientMutationId } : {}),
          trainerId,
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
      if ((error as { code?: string }).code === "P2003") {
        return reply.status(400).send({ message: "Entrenador no encontrado." });
      }
      throw error;
    }
  });

  app.put("/api/students/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateStudentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      });
    }

    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ message: "Estudiante no encontrado." });
    }

    const trainerId = parsed.data.trainerId.toLowerCase();
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) return reply.status(400).send({ message: "Entrenador no encontrado." });

    const student = await prisma.student.update({
      where: { id },
      data: {
        trainerId,
        name: parsed.data.name,
        document: parsed.data.document || null,
        phone: parsed.data.phone || null,
      },
    });

    return reply.send(student);
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
