import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Payment, Student } from "./client";

export const isDesktop = isTauri();
export interface Snapshot {
  students: Student[];
  payments: Payment[];
  generatedAt: string;
}
export interface SyncStatus { generatedAt: string | null }

export const desktop = {
  initialize: () => invoke<void>("initialize_local"),
  replace: (snapshot: Snapshot) => invoke<void>("replace_snapshot", { snapshot }),
  students: () => invoke<Student[]>("list_local_students"),
  payments: (studentId: string) => invoke<Payment[]>("list_local_payments", { studentId }),
  status: () => invoke<SyncStatus>("local_sync_status"),
  enqueueStudent: (student: Student) => invoke<Student>("enqueue_student", { student }),
  pendingStudents: () => invoke<Student[]>("list_pending_students"),
  acknowledgeStudent: (clientMutationId: string, student: Student) =>
    invoke<void>("acknowledge_student", { clientMutationId, student }),
  enqueuePayment: (payment: Payment) => invoke<Payment>("enqueue_payment", { payment }),
  pendingPayments: () => invoke<Payment[]>("list_pending_payments"),
  acknowledgePayment: (clientMutationId: string, payment: Payment) =>
    invoke<void>("acknowledge_payment", { clientMutationId, payment }),
};

// Failure is shown separately from navigator.onLine: a connected network need not reach the API.
export const syncEvents = new EventTarget();
export let syncError: string | null = null;
export function notifySync(error: string | null) {
  syncError = error;
  syncEvents.dispatchEvent(new Event("change"));
}
