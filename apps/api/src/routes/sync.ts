import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function syncRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    await request.jwtVerify().catch(() => reply.status(401).send({ message: "No autorizado." }));
  });

  app.get("/api/sync/snapshot", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    // Both reads must see the same database version, including concurrent writes.
    return prisma.$transaction(async (tx) => {
      const students = await tx.student.findMany({ orderBy: { name: "asc" } });
      const payments = await tx.payment.findMany({ orderBy: { paymentDate: "desc" } });
      return { students, payments, generatedAt: new Date().toISOString() };
    }, { isolationLevel: "RepeatableRead" });
  });
}
