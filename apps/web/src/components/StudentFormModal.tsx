import { useEffect, useState } from "react";
import { Button, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type Student, type Trainer } from "../api/client";
import { isDesktop } from "../api/desktop";
import { IconDeviceFloppy } from "@tabler/icons-react";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface StudentFormModalProps {
  trainerRevision?: number;
  opened: boolean;
  onClose: () => void;
  onCreated: (student: Student) => void;
}

export function StudentFormModal({ opened, onClose, onCreated, trainerRevision = 0 }: StudentFormModalProps) {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [trainerError, setTrainerError] = useState<string | null>(null);
  useEffect(() => {
    if (!opened) return;
    let active = true;
    const load = () => { void api.listTrainers().then((rows) => {
      if (active) { setTrainers(rows); setTrainerError(null); }
    }).catch(() => { if (active) setTrainerError("No se pudieron cargar los entrenadores."); }); };
    load();
    return () => { active = false; };
  }, [opened, trainerRevision]);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChanges = trainerId !== null || name.trim() !== "" || document.trim() !== "" || phone.trim() !== "";

  function reset() {
    setTrainerId(null);
    setTrainerError(null);
    setName("");
    setDocument("");
    setPhone("");
    setError(null);
    setDocumentError(null);
    setPhoneError(null);
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
    if (!document) {
      setDocumentError("El documento es obligatorio.");
      return;
    }
    if (!/^\d+$/.test(document)) {
      setDocumentError("El documento debe contener solo números, sin puntos ni espacios.");
      return;
    }
    if (!phone) {
      setPhoneError("El teléfono es obligatorio.");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError("El teléfono debe tener exactamente 10 dígitos.");
      return;
    }
    if (!trainerId) { setTrainerError("Seleccioná un entrenador."); return; }
    setError(null);
    setDocumentError(null);
    setPhoneError(null);
    setIsSubmitting(true);
    try {
      const student = await api.createStudent({
        trainerId,
        name: name.trim(),
        document: document.trim(),
        phone: phone.trim(),
        activationMonth: currentMonth(),
      });
      notifications.show({
        color: "green",
        title: "Jugador registrado",
        message: `${student.name} fue agregado correctamente.`,
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
    <Modal opened={opened} onClose={handleClose} title="Registrar jugador" centered>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="lg">
          {isDesktop && <Text size="sm" c="dimmed">Se guardará en este equipo. No se requiere conexión a internet.</Text>}
          <TextInput
            label="Nombre"
            placeholder="Nombre y apellido"
            withAsterisk
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={error ?? undefined}
          />
          <Select
            label="Entrenador"
            withAsterisk
            searchable
            value={trainerId}
            onChange={setTrainerId}
            data={trainers.map((trainer) => ({ value: trainer.id, label: trainer.name }))}
            placeholder="Seleccioná un entrenador"
            nothingFoundMessage="No hay entrenadores"
            error={trainerError}
          />
          {trainers.length === 0 && <Text size="sm" c="dimmed">Primero registrá un entrenador con el botón «Registrar entrenador».</Text>}
          <TextInput
            label="Documento"
            placeholder="Número de documento"
            withAsterisk
            value={document}
            onChange={(event) => setDocument(event.currentTarget.value.replace(/\D/g, ""))}
            error={documentError ?? undefined}
          />
          <TextInput
            label="Teléfono"
            placeholder="Teléfono de contacto"
            withAsterisk
            value={phone}
            onChange={(event) => setPhone(event.currentTarget.value.replace(/\D/g, "").slice(0, 10))}
            error={phoneError ?? undefined}
          />
          <Button type="submit" leftSection={<IconDeviceFloppy size={18} />} loading={isSubmitting}>
            Guardar
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
