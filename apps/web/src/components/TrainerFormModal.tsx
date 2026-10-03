import { useState } from "react";
import { Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import { api, type Trainer } from "../api/client";
import { isDesktop } from "../api/desktop";
import { notifications } from "@mantine/notifications";

export function TrainerFormModal({ opened, onClose, onCreated }: {
  opened: boolean;
  onClose: () => void;
  onCreated: (trainer: Trainer) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  function close() {
    if (saving || (name.trim() && !window.confirm("¿Descartar los datos ingresados?"))) return;
    setName(""); setError(null); onClose();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError(null);
    try {
      const trainer = await api.createTrainer({ name: name.trim() });
      onCreated(trainer);
      notifications.show({ color: "green", title: "Entrenador registrado", message: trainer.syncStatus === "pending"
        ? "Guardado en este equipo. Pendiente de sincronización." : "Entrenador agregado correctamente." });
      setName(""); onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally { setSaving(false); }
  }
  return <Modal opened={opened} onClose={close} title="Registrar entrenador" centered>
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        {isDesktop && <Text size="sm" c="dimmed">Se guardará en este equipo, incluso sin conexión.</Text>}
        <TextInput label="Nombre" withAsterisk value={name} onChange={(event) => setName(event.currentTarget.value)} error={error} />
        <Button type="submit" loading={saving}>Guardar</Button>
      </Stack>
    </form>
  </Modal>;
}
