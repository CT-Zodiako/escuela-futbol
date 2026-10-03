import { useEffect, useState } from "react";
import { Button, Modal, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type Payment, type Student } from "../api/client";
import { isDesktop } from "../api/desktop";
import { parseDateOnly, toDateOnlyString } from "../date";
import { IconDeviceFloppy } from "@tabler/icons-react";

interface PaymentFormModalProps {
  opened: boolean;
  student: Student | null;
  payment?: Payment | null;
  onClose: () => void;
  onCreated: (payment: Payment) => void;
  onUpdated?: (payment: Payment) => void;
}

export function PaymentFormModal({
  opened,
  student,
  payment,
  onClose,
  onCreated,
  onUpdated,
}: PaymentFormModalProps) {
  const isEditing = Boolean(payment);
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    if (payment) {
      setPaymentDate(parseDateOnly(payment.paymentDate));
      setConcept(payment.concept ?? "");
      setAmount(payment.amount);
      setMethod(payment.method);
      setNote(payment.note ?? "");
    } else {
      setPaymentDate(new Date());
      setConcept("");
      setAmount("");
      setMethod("cash");
      setNote("");
    }
    setError(null);
  }, [opened, payment]);

  function handleClose() {
    const hasChanges = isEditing
      ? amount !== payment?.amount ||
        concept.trim() !== (payment?.concept ?? "") || note.trim() !== (payment?.note ?? "")
      : concept.trim() !== "" || amount !== "" || note.trim() !== "";
    if (hasChanges) {
      const confirmed = window.confirm("¿Descartar los datos ingresados?");
      if (!confirmed) return;
    }
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentDate) return;
    if (!isEditing && !student) return;

    if (!concept.trim()) {
      setError("El concepto es obligatorio.");
      return;
    }

    if (amount === "" || amount <= 0) {
      setError("No puede ingresar un valor negativo.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (isEditing && payment) {
        const updated = await api.updatePayment(payment.id, {
          concept: concept.trim(),
          paymentDate: toDateOnlyString(paymentDate),
          amount,
          method,
          note: note.trim() || undefined,
        });
        notifications.show({
          color: "green",
          title: "Pago actualizado",
          message: "Los cambios se guardaron correctamente.",
          autoClose: 5000,
          withCloseButton: true,
        });
        onUpdated?.(updated);
      } else if (student) {
        const created = await api.createPayment({
          studentId: student.id,
          concept: concept.trim(),
          paymentDate: toDateOnlyString(paymentDate),
          amount,
          method,
          note: note.trim() || undefined,
        });
        notifications.show({
          color: "green",
          title: "Pago guardado",
          message: isDesktop
            ? `Se registró el pago de ${student.name}.`
            : `Se registró el pago de ${student.name}. Comprobante Nº ${created.receiptNumber}.`,
          autoClose: 5000,
          withCloseButton: true,
        });
        onCreated(created);
      }
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? submitError.message
          : "Ocurrió un error inesperado.";
      notifications.show({
        color: "red",
        title: isEditing ? "No se pudo actualizar el pago" : "No se pudo guardar el pago",
        message,
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = isEditing
    ? "Editar pago"
    : student
      ? `Registrar pago — ${student.name}`
      : "Registrar pago";

  return (
    <Modal opened={opened} onClose={handleClose} title={title} centered>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="lg">
          <DateInput
            label="Fecha de pago"
            valueFormat="DD/MM/YYYY"
            value={paymentDate}
            onChange={setPaymentDate}
            withAsterisk
            popoverProps={{ withinPortal: true }}
          />
          {!isEditing && (isDesktop
            ? <Text size="sm" c="dimmed">El pago se guarda directamente en este equipo.</Text>
            : <Text size="sm" c="dimmed">El número de comprobante se asigna automáticamente al registrar el pago.</Text>)}
          <TextInput
            label="Concepto"
            placeholder="Mensualidad escuela de fútbol"
            withAsterisk
            maxLength={160}
            value={concept}
            onChange={(event) => setConcept(event.currentTarget.value)}
          />
          <NumberInput
            label="Valor recibido (COP)"
            placeholder="50000"
            withAsterisk
            min={1}
            allowNegative={false}
            allowDecimal={false}
            thousandSeparator="."
            decimalSeparator=","
            inputMode="numeric"
            value={amount}
            onChange={(value) => setAmount(typeof value === "number" ? value : "")}
            error={error ?? undefined}
          />
          <Select
            label="Método de pago"
            data={[{ value: "cash", label: "Efectivo" }]}
            value={method}
            onChange={(value) => setMethod(value ?? "cash")}
          />
          <Textarea
            label="Observación (opcional)"
            placeholder="Ej: pago adelantado, incluye octubre y noviembre"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            autosize
            maxLength={280}
            minRows={2}
          />
          <Button type="submit" leftSection={<IconDeviceFloppy size={18} />} loading={isSubmitting}>
            Guardar
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
