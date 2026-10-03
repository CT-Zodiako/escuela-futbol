import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  transaction: vi.fn(), query: vi.fn(), student: vi.fn(), find: vi.fn(), findFirst: vi.fn(), create: vi.fn(),
}));
vi.mock("./db.js", () => ({ prisma: { $transaction: db.transaction } }));
import { paymentRoutes } from "./routes/payments.js";

const input = {
  studentId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
  clientMutationId: "c3f1a2c4-1111-4b2b-9c3d-1234567890ab",
  concept: "Mensualidad", paymentDate: "2026-09-05", amount: 50000,
};
const apps: ReturnType<typeof Fastify>[] = [];
async function server() {
  const app = Fastify();
  apps.push(app);
  app.register(jwt, { secret: "payments-test-only-secret" });
  app.register(paymentRoutes);
  await app.ready();
  const headers = { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` };
  return { app, headers };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.student.mockResolvedValue({ id: input.studentId });
  db.find.mockResolvedValue(null);
  db.findFirst.mockResolvedValue(null);
  db.query.mockImplementation(async (sql: TemplateStringsArray) =>
    sql.join("").includes("UPDATE") ? [{ value: 43 }] : [{ id: 1 }]);
  db.create.mockImplementation(async ({ data }) => ({ id: "server-payment", ...data }));
  db.transaction.mockImplementation(async (callback) => callback({
    $queryRaw: db.query,
    student: { findUnique: db.student },
    payment: { findUnique: db.find, findFirst: db.findFirst, create: db.create },
  }));
});
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("POST /api/payments", () => {
  it("requires authentication before allocation", async () => {
    const { app } = await server();
    const response = await app.inject({ method: "POST", url: "/api/payments", payload: input });
    expect(response.statusCode).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("assigns the locked global counter instead of a browser-supplied number", async () => {
    const { app, headers } = await server();
    const { clientMutationId: _omit, ...browser } = input;
    const response = await app.inject({ method: "POST", url: "/api/payments", headers,
      payload: { ...browser, receiptNumber: 999 } });
    expect(response.statusCode).toBe(201);
    expect(response.json().receiptNumber).toBe(43);
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(db.query.mock.calls[0][0].join("")).toContain("FOR UPDATE");
    expect(db.query.mock.calls[1][0].join("")).toContain('"value" + 1');
    expect(db.create).toHaveBeenCalledWith({ data: expect.objectContaining({ receiptNumber: 43 }) });
  });

  it("replays a lost acknowledgement without inserting or allocating again", async () => {
    const { app, headers } = await server();
    const first = await app.inject({ method: "POST", url: "/api/payments", headers, payload: input });
    expect(first.statusCode).toBe(201);
    db.find.mockResolvedValue(first.json());
    db.query.mockClear();
    const retry = await app.inject({ method: "POST", url: "/api/payments", headers, payload: input });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.find).toHaveBeenLastCalledWith({ where: { clientMutationId: input.clientMutationId } });
    expect(db.query.mock.invocationCallOrder[0]).toBeLessThan(db.find.mock.invocationCallOrder[1]);
  });

  it("rejects invalid mutations without allocating a receipt", async () => {
    const { app, headers } = await server();
    for (const invalid of [{ clientMutationId: "bad" }, { paymentDate: "bad" }, { amount: 0 }]) {
      const response = await app.inject({ method: "POST", url: "/api/payments", headers,
        payload: { ...input, ...invalid } });
      expect(response.statusCode).toBe(400);
    }
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("does not increment for missing students", async () => {
    db.student.mockResolvedValue(null);
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/payments", headers, payload: input });
    expect(response.statusCode).toBe(404);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("rejects a second payment for the same student and month without allocating", async () => {
    db.findFirst.mockResolvedValue({ id: "existing-payment", studentId: input.studentId });
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/payments", headers, payload: input });
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("mes");
    // The lock was taken but the counter never incremented and nothing was inserted.
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0].join("")).toContain("FOR UPDATE");
    expect(db.create).not.toHaveBeenCalled();
  });

  it("accepts a payment when the student has none in that month", async () => {
    db.findFirst.mockResolvedValue(null);
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/payments", headers,
      payload: { ...input, paymentDate: "2026-10-05" } });
    expect(response.statusCode).toBe(201);
    expect(response.json().receiptNumber).toBe(43);
    expect(db.findFirst).toHaveBeenCalledWith({ where: { studentId: input.studentId,
      paymentDate: { gte: new Date("2026-10-01"), lt: new Date("2026-11-01") } } });
    expect(db.create).toHaveBeenCalled();
  });

  it("propagates insertion failure through the transaction boundary", async () => {
    db.create.mockRejectedValue(new Error("database unavailable"));
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/payments", headers, payload: input });
    expect(response.statusCode).toBe(500);
    await expect(db.transaction.mock.results[0].value).rejects.toThrow("database unavailable");
  });
});
