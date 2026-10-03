import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ find: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock("./db.js", () => ({ prisma: { trainer: { findUnique: db.find, findMany: db.list, create: db.create } } }));
import { trainerRoutes } from "./routes/trainers.js";
const input = { name: "  Entrenador  ", clientMutationId: "c3f1a2c4-1111-4b2b-9c3d-1234567890ab" };
const apps: ReturnType<typeof Fastify>[] = [];
async function server() {
  const app = Fastify(); apps.push(app);
  app.register(jwt, { secret: "trainers-test-only-secret" });
  app.register(trainerRoutes); await app.ready();
  return { app, headers: { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` } };
}
beforeEach(() => {
  vi.resetAllMocks(); db.find.mockResolvedValue(null); db.list.mockResolvedValue([]);
  db.create.mockImplementation(async ({ data }) => data);
});
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
describe("trainer routes", () => {
  it("authenticates list and creation and validates before storage", async () => {
    const { app, headers } = await server();
    for (const method of ["GET", "POST"] as const) {
      expect((await app.inject({ method, url: "/api/trainers" })).statusCode).toBe(401);
    }
    for (const payload of [{ name: " " }, { ...input, clientMutationId: "bad" }, {}]) {
      expect((await app.inject({ method: "POST", url: "/api/trainers", headers, payload })).statusCode).toBe(400);
    }
    expect(db.create).not.toHaveBeenCalled(); expect(db.find).not.toHaveBeenCalled();
    expect((await app.inject({ method: "GET", url: "/api/trainers", headers })).json()).toEqual([]);
    expect(db.list).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });
  it("normalizes trainer names to title case on creation", async () => {
    const { app, headers } = await server();
    const response = await app.inject({ method: "POST", url: "/api/trainers", headers,
      payload: { name: "  jUAN   pÉREZ gONZÁLEZ  " } });
    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe("Juan Pérez González");
    expect(db.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Juan Pérez González" }),
    }));
  });
  it("retains the client UUID and replays the original trainer", async () => {
    const { app, headers } = await server();
    const first = await app.inject({ method: "POST", url: "/api/trainers", headers, payload: input });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ id: input.clientMutationId, name: "Entrenador" });
    db.find.mockResolvedValue(first.json());
    const retry = await app.inject({ method: "POST", url: "/api/trainers", headers,
      payload: { ...input, name: "Changed", clientMutationId: input.clientMutationId.toUpperCase() } });
    expect(retry.statusCode).toBe(200); expect(retry.json()).toEqual(first.json());
    expect(db.create).toHaveBeenCalledTimes(1);
  });
  it("recovers concurrent creation without masking other failures", async () => {
    const { app, headers } = await server();
    const saved = { ...input, id: input.clientMutationId };
    db.find.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    db.create.mockRejectedValue({ code: "P2002" });
    const response = await app.inject({ method: "POST", url: "/api/trainers", headers, payload: input });
    expect(response.statusCode).toBe(200); expect(response.json()).toEqual(saved);
    db.create.mockRejectedValue(new Error("unavailable"));
    expect((await app.inject({ method: "POST", url: "/api/trainers", headers, payload: input })).statusCode).toBe(500);
  });
});
