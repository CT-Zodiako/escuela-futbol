import { useState } from "react";
import { Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type Student } from "../api/client";
import { isDesktop } from "../api/desktop";
import { IconDeviceFloppy } from "@tabler/icons-react";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface StudentFormModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (student: Student) => void;
}

export function StudentFormModal({ opened, onClose, onCreated }: StudentFormModalProps) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChanges = name.trim() !== "" || document.trim() !== "" || phone.trim() !== "";

  function reset() {
    setName("");
    setDocument("");
    setPhone("");
    setError(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    if (hasChanges) {
      const confirmed = window.confirm("¿Descartar los datos ingresados?");
      if (!confirmed) return;
    }
    reset();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const student = await api.createStudent({
        name: name.trim(),
        document: document.trim() || undefined,
        phone: phone.trim() || undefined,
        activationMonth: currentMonth(),
      });
      notifications.show({
        color: "green",
        title: "Estudiante registrado",
        message: student.syncStatus === "pending"
          ? `${student.name} se guardó en este equipo. Pendiente de sincronización.`
          : `${student.name} fue agregado correctamente.`,
        autoClose: 5000,
        withCloseButton: true,
      });
      reset();
      onCreated(student);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof ApiError
          ? submitError.message
          : "Ocurrió un error inesperado.";
      notifications.show({
        color: "red",
        title: "No se pudo guardar",
        message,
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Registrar estudiante" centered>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="lg">
          {isDesktop && <Text size="sm" c="dimmed">Se guardará en este equipo, incluso sin conexión. Quedará pendiente de sincronización hasta que el servidor confirme el registro.</Text>}
          <TextInput
            label="Nombre"
            placeholder="Nombre y apellido"
            withAsterisk
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={error ?? undefined}
          />
          <TextInput
            label="Documento (opcional)"
            value={document}
            onChange={(event) => setDocument(event.currentTarget.value)}
          />
          <TextInput
            label="Teléfono (opcional)"
            value={phone}
            onChange={(event) => setPhone(event.currentTarget.value)}
          />
          <Button type="submit" leftSection={<IconDeviceFloppy size={18} />} loading={isSubmitting}>
            Guardar
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
