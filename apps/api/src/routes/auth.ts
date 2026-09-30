import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Credenciales inválidas." });
    }

    const admin = await prisma.admin.findUnique({
      where: { email: parsed.data.email },
    });
    if (!admin) {
      return reply.status(401).send({ message: "Credenciales inválidas." });
    }

    const passwordMatches = await bcrypt.compare(
      parsed.data.password,
      admin.passwordHash,
    );
    if (!passwordMatches) {
      return reply.status(401).send({ message: "Credenciales inválidas." });
    }

    const token = app.jwt.sign({ sub: admin.id, email: admin.email });
    return reply.send({ token });
  });
}
