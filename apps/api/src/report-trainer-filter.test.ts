import Fastify from "fastify";
import jwt from "@fastify/jwt";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ payments: vi.fn() }));
vi.mock("./db.js", () => ({ prisma: { payment: { findMany: db.payments } } }));
import { reportRoutes } from "./routes/reports.js";

const trainerId = "c3f1a2c4-1111-4b2b-9c3d-1234567890ab";
const apps: ReturnType<typeof Fastify>[] = [];
async function server() {
  const app = Fastify();
  apps.push(app);
  app.register(jwt, { secret: "reports-test-only-secret" });
  app.register(reportRoutes);
  await app.ready();
  return { app, headers: { authorization: `Bearer ${app.jwt.sign({ sub: "admin" })}` } };
}
const range = "from=2026-09-01&to=2026-09-30";
const payment = (studentId: string, name: string, amount: number) => ({
  studentId, amount, paymentDate: new Date("2026-09-15T12:00:00Z"),
  method: "cash", note: null, student: { name, document: "123" },
});
beforeEach(() => { vi.resetAllMocks(); db.payments.mockResolvedValue([]); });
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

async function worksheetRows(payload: Buffer<ArrayBufferLike>): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS 4.4 declares a legacy non-generic Buffer; @types/node now returns Buffer<ArrayBuffer>.
  // Scoped compatibility cast at this test-only workbook load boundary.
  await workbook.xlsx.load(
    Buffer.from(payload) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let i = 1; i <= row.cellCount; i++) values.push(row.getCell(i).text);
    rows.push(values);
  });
  return rows;
}
const studentNames = (rows: string[][]) => rows.slice(1).map((row) => row[0]);

describe.each(["summary", "export"])("%s trainer filter", (endpoint) => {
  it("requires authentication and rejects invalid trainer IDs before querying", async () => {
    const { app, headers } = await server();
    const url = `/api/reports/${endpoint}?${range}`;
    expect((await app.inject({ url })).statusCode).toBe(401);
    for (const value of ["bad", ""]) {
      const response = await app.inject({ url: `${url}&trainerId=${value}`, headers });
      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe("Entrenador inválido.");
    }
    expect(db.payments).not.toHaveBeenCalled();
  });

  it.each([undefined, trainerId])("preserves dates and scopes the student relation for %s", async (filter) => {
    const { app, headers } = await server();
    const response = await app.inject({
      url: `/api/reports/${endpoint}?${range}${filter ? `&trainerId=${filter}` : ""}`, headers,
    });
    expect(response.statusCode).toBe(200);
    const to = new Date("2026-09-30");
    to.setHours(23, 59, 59, 999);
    expect(db.payments.mock.calls[0][0].where).toEqual({
      paymentDate: { gte: new Date("2026-09-01"), lte: to },
      ...(filter ? { student: { trainerId: filter } } : {}),
    });
    if (endpoint === "summary") {
      expect(response.json()).toEqual({ totalCollected: 0, studentsPaidCount: 0, paymentsCount: 0, paidStudents: [] });
    } else {
      expect((await worksheetRows(response.rawPayload))).toHaveLength(1);
    }
  });

  it("returns totals or an XLSX workbook from the scoped payments only", async () => {
    const { app, headers } = await server();
    const selected = [payment("a", "Ana", 50), payment("a", "Ana", 75)];
    const other = payment("b", "Beatriz", 100);
    db.payments.mockImplementation(async ({ where }) => where.student?.trainerId === trainerId
      ? selected : [...selected, other]);
    const filtered = await app.inject({ url: `/api/reports/${endpoint}?${range}&trainerId=${trainerId}`, headers });
    const all = await app.inject({ url: `/api/reports/${endpoint}?${range}`, headers });
    if (endpoint === "summary") {
      expect(filtered.json()).toEqual({ totalCollected: 125, studentsPaidCount: 1, paymentsCount: 2,
        paidStudents: [{ studentId: "a", name: "Ana", totalPaid: 125 }] });
      expect(all.json()).toMatchObject({ totalCollected: 225, studentsPaidCount: 2, paymentsCount: 3 });
    } else {
      expect(filtered.headers["content-type"]).toContain(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(filtered.headers["content-disposition"]).toMatch(/\.xlsx"$/);
      const filteredRows = await worksheetRows(filtered.rawPayload);
      const filteredNames = studentNames(filteredRows);
      expect(filteredRows).toHaveLength(3);
      expect(filteredNames).toContain("Ana");
      expect(filteredNames).not.toContain("Beatriz");
      const allNames = studentNames(await worksheetRows(all.rawPayload));
      expect(allNames).toContain("Ana");
      expect(allNames).toContain("Beatriz");
    }
  });
});
