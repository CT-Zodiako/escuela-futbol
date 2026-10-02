import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  students: vi.fn(), payments: vi.fn(), transaction: vi.fn(),
}));
vi.mock("./db.js", () => ({ prisma: { $transaction: db.transaction } }));
import { syncRoutes } from "./routes/sync.js";

const apps: ReturnType<typeof Fastify>[] = [];
async function server() {
  const app = Fastify();
  apps.push(app);
  app.register(jwt, { secret: "snapshot-test-only-secret" });
  app.register(syncRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  db.students.mockResolvedValue([]);
  db.payments.mockResolvedValue([]);
  db.transaction.mockImplementation(async (callback) => callback({
    student: { findMany: db.students }, payment: { findMany: db.payments },
  }));
});
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("GET /api/sync/snapshot", () => {
  it("rejects missing and invalid credentials before querying the database", async () => {
    const app = await server();
    for (const headers of [{}, { authorization: "Bearer invalid" }]) {
      const response = await app.inject({ url: "/api/sync/snapshot", headers });
      expect(response.statusCode).toBe(401);
    }
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns all students and payments in one repeatable-read transaction", async () => {
    const students = [{ id: "inactive", isActive: false }, { id: "active", isActive: true }];
    const payments = [{ id: "old", studentId: "inactive", receiptNumber: null, concept: null },
      { id: "new", studentId: "active", receiptNumber: 123, concept: "Cuota" }];
    db.students.mockResolvedValue(students);
    db.payments.mockResolvedValue(payments);
    const app = await server();
    const response = await app.inject({ url: "/api/sync/snapshot",
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json();
    expect(body.students).toEqual(students);
    expect(body.payments).toEqual(payments);
    expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
    expect(db.students).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    expect(db.payments).toHaveBeenCalledWith({ orderBy: { paymentDate: "desc" } });
  });

  it("returns a complete empty snapshot", async () => {
    const app = await server();
    const response = await app.inject({ url: "/api/sync/snapshot",
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ students: [], payments: [] });
  });

  it("never returns a partial snapshot if the payment read fails", async () => {
    db.payments.mockRejectedValue(new Error("database unavailable"));
    const app = await server();
    const response = await app.inject({ url: "/api/sync/snapshot",
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).not.toHaveProperty("students");
  });
});
