import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { createTrainerSchema } from "../validation.js";

export function titleCaseName(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export async function trainerRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    await request.jwtVerify().catch(() => reply.status(401).send({ message: "No autorizado." }));
  });

  app.get("/api/trainers", async () => prisma.trainer.findMany({ orderBy: { name: "asc" } }));

  app.post("/api/trainers", async (request, reply) => {
    const parsed = createTrainerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    const clientMutationId = parsed.data.clientMutationId?.toLowerCase();
    if (clientMutationId) {
      const existing = await prisma.trainer.findUnique({ where: { clientMutationId } });
      if (existing) return reply.send(existing);
    }
    try {
      const trainer = await prisma.trainer.create({ data: {
        ...(clientMutationId ? { id: clientMutationId, clientMutationId } : {}),
        name: titleCaseName(parsed.data.name),
      } });
      return reply.status(201).send(trainer);
    } catch (error) {
      if (clientMutationId && (error as { code?: string }).code === "P2002") {
        const existing = await prisma.trainer.findUnique({ where: { clientMutationId } });
        if (existing) return reply.send(existing);
      }
      throw error;
    }
  });
}
