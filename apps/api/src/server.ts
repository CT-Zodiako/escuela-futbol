import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { studentRoutes } from "./routes/students.js";
import { paymentRoutes } from "./routes/payments.js";
import { reportRoutes } from "./routes/reports.js";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.webOrigin, "tauri://localhost", "http://tauri.localhost"],
  });
  app.register(jwt, { secret: env.jwtSecret });

  app.register(authRoutes);
  app.register(studentRoutes);
  app.register(paymentRoutes);
  app.register(reportRoutes);

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}

async function start() {
  const app = buildServer();
  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
