import { desktop, isDesktop, notifySync, type Snapshot } from "./desktop";

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
  if (isDesktop && options.method && options.method !== "GET" && path !== "/api/auth/login") {
    throw new ApiError("La aplicación de escritorio es de solo lectura. Registrá cambios en la versión web en línea.");
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
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
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

export interface Student {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  isActive: boolean;
  activationMonth: string;
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

let refreshInFlight: Promise<void> | null = null;
export function refreshSnapshot(): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      await desktop.initialize();
      const snapshot = await request<Snapshot>("/api/sync/snapshot");
      await desktop.replace(snapshot);
      notifySync(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifySync(message);
      throw new ApiError(message);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  listStudents: () => isDesktop ? desktop.students() : request<Student[]>("/api/students"),
  listPayments: (studentId: string) => isDesktop ? desktop.payments(studentId) :
    request<Payment[]>(`/api/payments?studentId=${encodeURIComponent(studentId)}`),
  getReportSummary: (from: string, to: string) =>
    request<ReportSummary>(
      `/api/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  createStudent: (data: {
    name: string;
    document?: string;
    phone?: string;
    activationMonth: string;
  }) =>
    request<Student>("/api/students", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createPayment: (data: {
    studentId: string;
    receiptNumber: number;
    concept: string;
    paymentDate: string;
    amount: number;
    method: string;
    note?: string;
  }) =>
    request<Payment>("/api/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePayment: (
    id: string,
    data: { concept: string; paymentDate: string; amount: number; method: string; note?: string },
  ) =>
    request<Payment>(`/api/payments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setStudentStatus: (id: string, isActive: boolean) =>
    request<Student>(`/api/students/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    }),
  getPendingReport: (month: string) =>
    request<PendingReport>(`/api/reports/pending?month=${encodeURIComponent(month)}`),
  exportPayments: async (from: string, to: string): Promise<Blob> => {
    const token = getToken();
    const response = await fetch(
      `${API_URL}/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.message ?? "No se pudo exportar la información.");
    }
    return response.blob();
  },
};
