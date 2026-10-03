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
  if (isDesktop && options.method && options.method !== "GET" && path !== "/api/auth/login"
    && !(["/api/payments", "/api/students"].includes(path) && options.method === "POST")) {
    throw new ApiError("Este cambio no está disponible en escritorio. Podés registrar estudiantes y pagos.");
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

export interface Student {
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

export interface CreatePaymentInput {
  studentId: string;
  receiptNumber?: number;
  concept: string;
  paymentDate: string;
  amount: number;
  method: string;
  note?: string;
}

let studentsInFlight: Promise<void> | null = null;
export function syncPendingStudents(): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  if (studentsInFlight) return studentsInFlight;
  studentsInFlight = (async () => {
    try {
      await desktop.initialize();
      for (;;) {
        const pending = await desktop.pendingStudents();
        if (!pending.length) break;
        const failures: unknown[] = [];
        for (const student of pending) {
          try {
            const saved = await request<Student>("/api/students", {
              method: "POST",
              body: JSON.stringify({
                clientMutationId: student.clientMutationId,
                name: student.name,
                document: student.document ?? undefined,
                phone: student.phone ?? undefined,
                activationMonth: student.activationMonth,
              }),
            });
            await desktop.acknowledgeStudent(student.clientMutationId!, saved);
            notifySync(null);
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length) throw failures[0];
      }
      notifySync(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifySync(message);
      throw new ApiError(message);
    } finally {
      studentsInFlight = null;
    }
  })();
  return studentsInFlight;
}

// Students precede their payments, but a rejected student must not starve
// payments for other students. Both queues retain failures for the next retry.
async function syncPendingOutboxes(): Promise<void> {
  const failures: unknown[] = [];
  try { await syncPendingStudents(); } catch (error) { failures.push(error); }
  try { await syncPendingPayments(); } catch (error) { failures.push(error); }
  if (failures.length) {
    const error = failures[0];
    const message = error instanceof Error ? error.message : String(error);
    notifySync(message);
    throw new ApiError(message);
  }
}

let paymentsInFlight: Promise<void> | null = null;
export function syncPendingPayments(): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  if (paymentsInFlight) return paymentsInFlight;
  paymentsInFlight = (async () => {
    try {
      await desktop.initialize();
      // Drain again after acknowledgements: another payment may have been queued
      // while requests were in flight. A lost response leaves the same UUID pending.
      for (;;) {
        const pending = await desktop.pendingPayments();
        if (!pending.length) break;
        const failures: unknown[] = [];
        for (const payment of pending) {
          try {
            const saved = await request<Payment>("/api/payments", {
              method: "POST",
              body: JSON.stringify({
                clientMutationId: payment.clientMutationId,
                studentId: payment.studentId,
                concept: payment.concept,
                paymentDate: payment.paymentDate,
                amount: payment.amount,
                method: payment.method,
                note: payment.note ?? undefined,
              }),
            });
            await desktop.acknowledgePayment(payment.clientMutationId!, saved);
            notifySync(null);
          } catch (error) {
            // One permanently rejected entry must not starve unrelated payments.
            failures.push(error);
          }
        }
        if (failures.length) throw failures[0];
      }
      notifySync(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifySync(message);
      throw new ApiError(message);
    } finally {
      paymentsInFlight = null;
    }
  })();
  return paymentsInFlight;
}

// Run only while the authenticated dashboard is mounted. A timer also catches
// recovery when navigator.onLine stays true but the server was unreachable.
export function startPaymentSync(): () => void {
  if (!isDesktop) return () => undefined;
  const retry = () => {
    if (getToken()) void syncPendingOutboxes().catch(() => undefined);
  };
  retry();
  window.addEventListener("online", retry);
  const timer = window.setInterval(retry, 30000);
  return () => {
    window.removeEventListener("online", retry);
    window.clearInterval(timer);
  };
}

let refreshInFlight: Promise<void> | null = null;
export function refreshSnapshot(): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      await desktop.initialize();
      await syncPendingOutboxes();
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
  createStudent: async (data: {
    name: string;
    document?: string;
    phone?: string;
    activationMonth: string;
  }): Promise<Student> => {
    const clientMutationId = crypto.randomUUID();
    if (!isDesktop) return request<Student>("/api/students", {
      method: "POST",
      body: JSON.stringify({ ...data, clientMutationId }),
    });
    await desktop.initialize();
    const student = await desktop.enqueueStudent({
      ...data,
      id: clientMutationId,
      clientMutationId,
      document: data.document ?? null,
      phone: data.phone ?? null,
      isActive: true,
      syncStatus: "pending",
    });
    notifySync(null);
    void syncPendingOutboxes().catch(() => undefined);
    return student;
  },
  createPayment: async (data: CreatePaymentInput): Promise<Payment> => {
    const clientMutationId = crypto.randomUUID();
    if (!isDesktop) return request<Payment>("/api/payments", {
      method: "POST",
      body: JSON.stringify({ ...data, clientMutationId }),
    });
    await desktop.initialize();
    const payment = await desktop.enqueuePayment({
      ...data,
      id: clientMutationId,
      clientMutationId,
      receiptNumber: null,
      note: data.note ?? null,
      syncStatus: "pending",
    });
    notifySync(null);
    void syncPendingOutboxes().catch(() => undefined);
    return payment;
  },
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
