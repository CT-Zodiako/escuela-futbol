import ExcelJS from "exceljs";
import { admin as desktopAdmin, desktop, isDesktop, type PaymentRecord } from "./desktop";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {}

function getToken(): string | null {
  return localStorage.getItem("escuela-futbol-token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("escuela-futbol-token", token);
  } else {
    localStorage.removeItem("escuela-futbol-token");
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Desktop is local-only: it never issues HTTP mutations. The guard stays so a
  // desktop build pointed at the dev API fails loudly instead of silently syncing.
  if (isDesktop && options.method && options.method !== "GET" && path !== "/api/auth/login") {
    throw new ApiError("Este cambio no está disponible en escritorio. Podés registrar jugadores y pagos.");
  }
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.",
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? "Ocurrió un error inesperado.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface Trainer {
  id: string;
  name: string;
  clientMutationId?: string | null;
  syncStatus?: "pending" | "synced" | null;
}

export interface Student {
  trainerId?: string | null;
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  isActive: boolean;
  activationMonth: string;
  clientMutationId?: string | null;
  syncStatus?: "pending" | "synced" | null;
}

export interface PendingStudent {
  studentId: string;
  name: string;
  status: "paid" | "pending";
}

export interface PendingReport {
  month: string;
  paidCount: number;
  pendingCount: number;
  students: PendingStudent[];
}

export interface Payment {
  id: string;
  studentId: string;
  receiptNumber: number | null;
  clientMutationId?: string | null;
  syncStatus?: "pending" | "synced" | null;
  paymentDate: string;
  amount: number;
  method: string;
  concept: string | null;
  note: string | null;
}

export interface ReportPaidStudent {
  studentId: string;
  name: string;
  totalPaid: number;
}

export interface ReportSummary {
  totalCollected: number;
  studentsPaidCount: number;
  paymentsCount: number;
  paidStudents: ReportPaidStudent[];
}

export interface GeneralReportStudent {
  studentId: string;
  name: string;
  months: number[];
  totalPaid: number;
}

export interface GeneralReport {
  year: number;
  students: GeneralReportStudent[];
  monthlyTotals: number[];
  totalCollected: number;
}

export interface CreatePaymentInput {
  studentId: string;
  receiptNumber?: number;
  concept: string;
  paymentDate: string;
  amount: number;
  method: string;
  note?: string;
}

// Tauri invoke rejects with plain strings; normalize them into ApiError so pages
// can show the command's safe message (never a password hash).
async function invokeOrApiError<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : String(error ?? "Ocurrió un error inesperado."));
  }
}

export const api = {
  login: (email: string, password: string) =>
    isDesktop ? invokeOrApiError(desktopAdmin.login(email, password)) :
    request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getSetupStatus: () =>
    isDesktop ? invokeOrApiError(desktopAdmin.setupStatus()) : Promise.resolve({ needsSetup: false }),
  createFirstAdmin: (data: { name: string; email: string; password: string }) =>
    isDesktop ? invokeOrApiError(desktopAdmin.createFirstAdmin(data)) :
    Promise.reject(new ApiError("La configuración inicial solo está disponible en la aplicación de escritorio.")),
  listTrainers: () => isDesktop ? desktop.trainers() : request<Trainer[]>("/api/trainers"),
  createTrainer: async (data: { name: string }): Promise<Trainer> => {
    const clientMutationId = crypto.randomUUID();
    if (!isDesktop) return request<Trainer>("/api/trainers", {
      method: "POST", body: JSON.stringify({ ...data, clientMutationId }),
    });
    // Local-only: the row is durable in SQLite on this machine; no network sync.
    await desktop.initialize();
    return desktop.enqueueTrainer({ ...data, id: clientMutationId, clientMutationId });
  },
  listStudents: () => isDesktop ? desktop.students() : request<Student[]>("/api/students"),
  listPayments: (studentId: string) => isDesktop ? desktop.payments(studentId) :
    request<Payment[]>(`/api/payments?studentId=${encodeURIComponent(studentId)}`),
  getReportSummary: (from: string, to: string, trainerId?: string) =>
    isDesktop ? invokeOrApiError(desktop.paymentSummary(from, to, trainerId)) :
    request<ReportSummary>(
      `/api/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${trainerId ? `&trainerId=${encodeURIComponent(trainerId)}` : ""}`,
    ),
  getGeneralReport: (year: number, trainerId?: string) =>
    isDesktop ? invokeOrApiError(desktop.generalReport(year, trainerId)) :
    request<GeneralReport>(`/api/reports/general?year=${year}${trainerId ? `&trainerId=${encodeURIComponent(trainerId)}` : ""}`),
  exportGeneralReport: async (year: number, trainerId?: string): Promise<Blob> => {
    if (isDesktop) {
      const report = await invokeOrApiError(desktop.generalReport(year, trainerId));
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Informe general");
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      worksheet.addRow(["Jugador", ...monthNames, "Total pagado"]);
      worksheet.getRow(1).font = { bold: true };
      report.students.forEach((student) => worksheet.addRow([student.name, ...student.months, student.totalPaid]));
      worksheet.addRow(["TOTAL POR MES", ...report.monthlyTotals, report.totalCollected]);
      worksheet.getRow(worksheet.rowCount).font = { bold: true };
      worksheet.columns = [{ width: 30 }, ...monthNames.map(() => ({ width: 14 })), { width: 16 }];
      const buffer = await workbook.xlsx.writeBuffer();
      return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    const token = getToken();
    const response = await fetch(`${API_URL}/api/reports/general/export?year=${year}${trainerId ? `&trainerId=${encodeURIComponent(trainerId)}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new ApiError("No se pudo exportar el informe general.");
    return response.blob();
  },
  createStudent: async (data: {
    trainerId: string;
    name: string;
    document: string;
    phone: string;
    activationMonth: string;
  }): Promise<Student> => {
    const clientMutationId = crypto.randomUUID();
    if (!isDesktop) return request<Student>("/api/students", {
      method: "POST",
      body: JSON.stringify({ ...data, clientMutationId }),
    });
    // Local-only: durable in SQLite immediately; there is no pending/synced state.
    await desktop.initialize();
    return desktop.enqueueStudent({
      ...data,
      id: clientMutationId,
      clientMutationId,
      isActive: true,
    });
  },
  createPayment: async (data: CreatePaymentInput): Promise<Payment> => {
    const clientMutationId = crypto.randomUUID();
    if (!isDesktop) return request<Payment>("/api/payments", {
      method: "POST",
      body: JSON.stringify({ ...data, clientMutationId }),
    });
    // Local-only: durable in SQLite immediately; no server receipt assignment.
    await desktop.initialize();
    return desktop.enqueuePayment({
      ...data,
      id: clientMutationId,
      clientMutationId,
      receiptNumber: null,
      note: data.note ?? null,
    });
  },
  updatePayment: (
    id: string,
    data: { concept: string; paymentDate: string; amount: number; method: string; note?: string },
  ) =>
    isDesktop ? invokeOrApiError(desktop.updatePayment(id, { ...data, note: data.note ?? null })) :
    request<Payment>(`/api/payments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateStudent: (
    id: string,
    data: { trainerId: string; name: string; document: string; phone: string },
  ) =>
    isDesktop ? invokeOrApiError(desktop.updateStudent(id, data)) :
    request<Student>(`/api/students/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setStudentStatus: (id: string, isActive: boolean) =>
    isDesktop ? invokeOrApiError(desktop.setStudentStatus(id, isActive)) :
    request<Student>(`/api/students/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    }),
  getPendingReport: (month: string) =>
    isDesktop ? invokeOrApiError(desktop.pendingReport(month)) :
    request<PendingReport>(`/api/reports/pending?month=${encodeURIComponent(month)}`),
  exportDatabaseBackup: async (fileName: string): Promise<string> => {
    if (isDesktop) {
      return invokeOrApiError(desktop.exportDatabaseBackup(fileName));
    }
    throw new ApiError("La copia de seguridad solo está disponible en la aplicación de escritorio.");
  },
  exportPaymentRecords: async (): Promise<Blob> => {
    if (isDesktop) {
      const records = await invokeOrApiError(desktop.exportPaymentRecords());
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pagos detallados");
      worksheet.addRow([
        "ID del jugador",
        "Nombre del jugador",
        "Documento",
        "Teléfono",
        "Entrenador",
        "Estado activo",
        "Mes de activación",
        "ID del pago",
        "Fecha de pago",
        "Valor pagado",
        "Método de pago",
        "Concepto",
        "Observación",
        "Número de recibo",
      ]);
      worksheet.getRow(1).font = { bold: true };
      records.forEach((record) => {
        worksheet.addRow([
          record.studentId,
          record.studentName,
          record.studentDocument,
          record.studentPhone,
          record.trainerName,
          record.studentIsActive ? "Sí" : "No",
          record.studentActivationMonth,
          record.paymentId,
          record.paymentDate,
          record.paymentAmount,
          record.paymentMethod,
          record.paymentConcept,
          record.paymentNote,
          record.receiptNumber ?? "",
        ]);
      });
      worksheet.columns = [
        { width: 20 },
        { width: 30 },
        { width: 18 },
        { width: 14 },
        { width: 25 },
        { width: 14 },
        { width: 18 },
        { width: 20 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 20 },
        { width: 25 },
        { width: 18 },
      ];
      const buffer = await workbook.xlsx.writeBuffer();
      return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    throw new ApiError("La exportación detallada de pagos solo está disponible en la aplicación de escritorio.");
  },
  exportPayments: async (from: string, to: string, trainerId?: string): Promise<Blob> => {
    // Desktop exports locally as CSV (Excel opens it); the server branch stays
    // XLSX for development. The Rust command returns the full CSV text with a
    // UTF-8 BOM, never a network URL or SQL.
    if (isDesktop) {
      const csv = await invokeOrApiError(desktop.exportPayments(from, to, trainerId));
      return new Blob([csv], { type: "text/csv;charset=utf-8" });
    }
    const token = getToken();
    const response = await fetch(
      `${API_URL}/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${trainerId ? `&trainerId=${encodeURIComponent(trainerId)}` : ""}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.message ?? "No se pudo exportar la información.");
    }
    return response.blob();
  },
};
