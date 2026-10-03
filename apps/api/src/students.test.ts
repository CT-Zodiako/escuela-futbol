import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), update: vi.fn(), trainer: vi.fn() }));
vi.mock("./db.js", () => ({ prisma: { trainer: { findUnique: db.trainer }, student: { findUnique: db.find, create: db.create, update: db.update } } }));
import { studentRoutes } from "./routes/students.js";

const input = {
  trainerId: "b3f1a2c4-1111-4b2b-9c3d-1234567890ab",
  name: "  Estudiante  ", document: " 1030456789 ", phone: "3001234567",
  activationMonth: "2026-09", clientMutationId: "c3f1a2c4-1111-4b2b-9c3d-1234567890ab",
};
const apps: ReturnType<typeof Fastify>[] = [];
async function server() {
  const app = Fastify();
  apps.push(app);
  app.register(jwt, { secret: "students-test-only-secret" });
  app.register(studentRoutes);
  await app.ready();
  return { app, headers: { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` } };
}
beforeEach(() => {
  vi.resetAllMocks();
  db.find.mockResolvedValue(null);
  db.trainer.mockResolvedValue({ id: input.trainerId });
  db.create.mockImplementation(async ({ data }) => ({ id: "server-id", isActive: true, ...data }));
  db.update.mockImplementation(async ({ where, data }) => ({ id: where.id, isActive: true, activationMonth: "2026-09", ...data }));
});
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("POST /api/students", () => {
  it("requires authentication and validates UUIDs before touching storage", async () => {
    const { app, headers } = await server();
    expect((await app.inject({ method: "POST", url: "/api/students", payload: input })).statusCode).toBe(401);
    for (const invalid of [{ clientMutationId: "bad" }, { name: " " }, { document: "" }, { phone: "   " }]) {
      expect((await app.inject({ method: "POST", url: "/api/students", headers,
        payload: { ...input, ...invalid } })).statusCode).toBe(400);
    }
    expect(db.find).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });

  it("requires an existing trainer and leaves rejected students retryable", async () => {
    const { app, headers } = await server();
    for (const trainerId of [undefined, null, "bad"]) {
      expect((await app.inject({ method: "POST", url: "/api/students", headers,
        payload: { ...input, trainerId } })).statusCode).toBe(400);
    }
    db.trainer.mockResolvedValueOnce(null);
    expect((await app.inject({ method: "POST", url: "/api/students", headers, payload: input })).statusCode).toBe(400);
    expect(db.create).not.toHaveBeenCalled();
    const retry = await app.inject({ method: "POST", url: "/api/students", headers, payload: input });
    expect(retry.statusCode).toBe(201);
    expect(retry.json().trainerId).toBe(input.trainerId);
  });

  it("keeps the offline identity and replays the original row without updating it", async () => {
    const { app, headers } = await server();
    const first = await app.inject({ method: "POST", url: "/api/students", headers, payload: input });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ id: input.clientMutationId, name: "Estudiante", document: "1030456789" });
    db.find.mockResolvedValue(first.json());
    const retry = await app.inject({ method: "POST", url: "/api/students", headers,
      payload: { ...input, name: "Changed", clientMutationId: input.clientMutationId.toUpperCase() } });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(db.find).toHaveBeenLastCalledWith({ where: { clientMutationId: input.clientMutationId } });
  });

  it("returns the winning row after a concurrent unique-index conflict", async () => {
    const original = { id: input.clientMutationId, ...input, name: "Original" };
    db.find.mockResolvedValueOnce(null).mockResolvedValueOnce(original);
    db.create.mockRejectedValue({ code: "P2002" });
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/students", headers, payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(original);
    expect(db.create).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy browser creation without a mutation ID working", async () => {
    const { clientMutationId: _omit, ...browser } = input;
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/students", headers, payload: browser });
    expect(response.statusCode).toBe(201);
    expect(db.find).not.toHaveBeenCalled();
    expect(db.create.mock.calls[0][0].data).not.toHaveProperty("clientMutationId");
    expect(db.create.mock.calls[0][0].data).not.toHaveProperty("id");
  });

  it("does not hide database failures or unrelated unique conflicts", async () => {
    const { app, headers } = await server();
    for (const error of [new Error("unavailable"), { code: "P2002" }]) {
      db.create.mockRejectedValue(error);
      const response = await app.inject({ method: "POST", url: "/api/students", headers, payload: input });
      expect(response.statusCode).toBe(500);
    }
  });
});

describe("PUT /api/students/:id", () => {
  const studentId = "a3f1a2c4-1111-4b2b-9c3d-1234567890ab";
  const edit = { trainerId: input.trainerId, name: "  Editado  ", document: " 1030456789 ", phone: "3007654321" };

  it("updates name, trainer, document, and phone while preserving identity fields", async () => {
    const { app, headers } = await server();
    db.find.mockResolvedValue({ id: studentId, ...edit, isActive: true, activationMonth: "2026-09" });
    const response = await app.inject({ method: "PUT", url: `/api/students/${studentId}`, headers, payload: edit });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: studentId, trainerId: input.trainerId,
      name: "Editado", document: "1030456789", phone: "3007654321",
      isActive: true, activationMonth: "2026-09",
    });
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.update.mock.calls[0][0]).toEqual({
      where: { id: studentId },
      data: { trainerId: input.trainerId, name: "Editado", document: "1030456789", phone: "3007654321" },
    });
    // Identity and billing fields are never rewritten by an edit.
    expect(db.update.mock.calls[0][0].data).not.toHaveProperty("isActive");
    expect(db.update.mock.calls[0][0].data).not.toHaveProperty("activationMonth");
  });

  it("requires an existing trainer before updating", async () => {
    const { app, headers } = await server();
    db.find.mockResolvedValue({ id: studentId, ...edit, isActive: true, activationMonth: "2026-09" });
    const missing = await app.inject({ method: "PUT", url: `/api/students/${studentId}`, headers,
      payload: { ...edit, trainerId: undefined } });
    expect(missing.statusCode).toBe(400);
    db.trainer.mockResolvedValueOnce(null);
    const unknown = await app.inject({ method: "PUT", url: `/api/students/${studentId}`, headers, payload: edit });
    expect(unknown.statusCode).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
    // A rejected edit leaves the student retryable with a valid trainer.
    const retry = await app.inject({ method: "PUT", url: `/api/students/${studentId}`, headers, payload: edit });
    expect(retry.statusCode).toBe(200);
  });

  it("returns 404 for a missing student without touching storage", async () => {
    const { app, headers } = await server();
    db.find.mockResolvedValue(null);
    const response = await app.inject({ method: "PUT", url: `/api/students/${studentId}`, headers, payload: edit });
    expect(response.statusCode).toBe(404);
    expect(db.trainer).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects invalid documents and phones without touching storage", async () => {
    const { app, headers } = await server();
    expect((await app.inject({ method: "PUT", url: `/api/students/${studentId}`, payload: edit })).statusCode).toBe(401);
    for (const invalid of [
      { name: " " },
      { document: "1.030.456.789" },
      { document: "1030 456 789" },
      { document: "1030456789a" },
      { document: "" },
      { phone: "300123456" },
      { phone: "30012345678" },
      { phone: "300-123-4567" },
      { phone: "   " },
    ]) {
      expect((await app.inject({ method: "PUT", url: `/api/students/${studentId}`, headers,
        payload: { ...edit, ...invalid } })).statusCode).toBe(400);
    }
    expect(db.find).not.toHaveBeenCalled();
    expect(db.trainer).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
