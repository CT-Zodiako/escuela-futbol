import { useEffect, useState } from "react";
import { Button, Modal, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type Payment, type Student } from "../api/client";
import { PaymentFormModal } from "./PaymentFormModal";
import { ReceiptModal } from "./ReceiptModal";

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface StudentHistoryModalProps {
  student: Student | null;
  onClose: () => void;
}

export function StudentHistoryModal({ student, onClose }: StudentHistoryModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (!student) return;
    loadPayments(student.id);
  }, [student]);

  async function loadPayments(studentId: string) {
    setIsLoading(true);
    try {
      const data = await api.listPayments(studentId);
      setPayments(data);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No se pudo cargar el historial",
        message:
          error instanceof ApiError ? error.message : "Ocurrió un error inesperado.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Modal
        opened={student !== null}
        onClose={onClose}
        title={student ? `Historial — ${student.name}` : "Historial"}
        centered
        size="lg"
      >
        {!isLoading && payments.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Todavía no hay pagos registrados para este estudiante.
          </Text>
        ) : (
          <Stack gap="md">
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Método</Table.Th>
                  <Table.Th>Observación</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td>{formatDate(payment.paymentDate)}</Table.Td>
                    <Table.Td>{formatCurrency(payment.amount)}</Table.Td>
                    <Table.Td>{payment.method === "cash" ? "Efectivo" : payment.method}</Table.Td>
                    <Table.Td>{payment.note ?? "—"}</Table.Td>
                    <Table.Td>
                      <Stack gap="xs">
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => setEditingPayment(payment)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setReceiptPayment(payment)}
                        >
                          Generar recibo
                        </Button>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>

      <PaymentFormModal
        opened={editingPayment !== null}
        student={student}
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onCreated={() => undefined}
        onUpdated={(updated) => {
          setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setEditingPayment(null);
        }}
      />

      <ReceiptModal
        student={student}
        payment={receiptPayment}
        onClose={() => setReceiptPayment(null)}
      />
    </>
  );
}
