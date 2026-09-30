import { useRef, useState } from "react";
import { Button, Divider, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Payment, Student } from "../api/client";

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

interface ReceiptModalProps {
  student: Student | null;
  payment: Payment | null;
  onClose: () => void;
}

export function ReceiptModal({ student, payment, onClose }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  function handlePrint() {
    window.print();
  }

  async function handleDownloadImage() {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(receiptRef.current, { backgroundColor: "#ffffff" });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo generar la imagen.");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `recibo-${student?.name.replace(/\s+/g, "-").toLowerCase()}-${payment?.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      notifications.show({
        color: "red",
        title: "No se pudo generar la imagen",
        message: "Ocurrió un error inesperado. Intentá de nuevo.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal opened={payment !== null} onClose={onClose} title="Recibo" centered>
      {student && payment ? (
        <Stack gap="lg">
          <div ref={receiptRef} className="receipt-print-area">
            <Stack gap="md" p="lg" style={{ border: "1px solid #E2E8F0", borderRadius: 8 }}>
              <Title order={3}>Escuela Futbol</Title>
              <Text size="sm" c="dimmed">
                Recibo de pago
              </Text>
              <Divider />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Estudiante
                </Text>
                <Text fw={600}>{student.name}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Fecha de pago
                </Text>
                <Text>{formatDate(payment.paymentDate)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Valor
                </Text>
                <Text fw={700} size="lg">
                  {formatCurrency(payment.amount)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Método de pago
                </Text>
                <Text>{payment.method === "cash" ? "Efectivo" : payment.method}</Text>
              </Group>
              {payment.note ? (
                <Group justify="space-between" align="flex-start">
                  <Text size="sm" c="dimmed">
                    Observación
                  </Text>
                  <Text ta="right">{payment.note}</Text>
                </Group>
              ) : null}
            </Stack>
          </div>

          <Group grow>
            <Button variant="default" onClick={handlePrint}>
              Imprimir
            </Button>
            <Button onClick={handleDownloadImage} loading={isDownloading}>
              Descargar imagen
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
