import { invoke, isTauri } from "@tauri-apps/api/core";
import type { GeneralReport, Payment, PendingReport, ReportSummary, Student, Trainer } from "./client";

export const isDesktop = isTauri();
export interface SetupStatus { needsSetup: boolean }
export interface AdminSession { token: string }
export interface NewAdmin { name: string; email: string; password: string }

export const admin = {
  setupStatus: () => invoke<SetupStatus>("local_setup_status"),
  createFirstAdmin: (admin: NewAdmin) => invoke<AdminSession>("create_first_admin", { admin }),
  login: (email: string, password: string) =>
    invoke<AdminSession>("login_local_admin", { email, password }),
  logout: (token: string) => invoke<void>("logout_local_admin", { token }),
};

// Local-only data access. The desktop SQLite database is the single source of
// truth: there is no snapshot download, no pending outbox sync, and no
// last-sync status to surface in the UI.
export const desktop = {
  initialize: () => invoke<void>("initialize_local"),
  // Pre-update checkpoint: copies historical.sqlite3 to an external backup
  // directory that the Windows installer never deletes.
  backupLocalData: () => invoke<void>("backup_local_data"),
  trainers: () => invoke<Trainer[]>("list_local_trainers"),
  enqueueTrainer: (trainer: Trainer) => invoke<Trainer>("enqueue_trainer", { trainer }),
  students: () => invoke<Student[]>("list_local_students"),
  payments: (studentId: string) => invoke<Payment[]>("list_local_payments", { studentId }),
  enqueueStudent: (student: Student) => invoke<Student>("enqueue_student", { student }),
  enqueuePayment: (payment: Payment) => invoke<Payment>("enqueue_payment", { payment }),
  updatePayment: (id: string, update: {
    concept: string;
    paymentDate: string;
    amount: number;
    method: string;
    note?: string | null;
  }) => invoke<Payment>("update_local_payment", { id, update }),
  setStudentStatus: (id: string, isActive: boolean) =>
    invoke<Student>("set_local_student_status", { id, isActive }),
  updateStudent: (id: string, update: {
    trainerId: string;
    name: string;
    document: string;
    phone: string;
  }) => invoke<Student>("update_local_student", { id, update }),
  paymentSummary: (from: string, to: string, trainerId?: string) =>
    invoke<ReportSummary>("local_payment_summary", { from, to, trainerId }),
  pendingReport: (month: string) => invoke<PendingReport>("local_pending_report", { month }),
  generalReport: (year: number, trainerId?: string) =>
    invoke<GeneralReport>("local_payment_general_report", { year, trainerId }),
  exportGeneralReport: (year: number, trainerId?: string) =>
    invoke<string>("export_local_general_report", { year, trainerId }),
  exportPayments: (from: string, to: string, trainerId?: string) =>
    invoke<string>("export_local_payments", { from, to, trainerId }),
};
