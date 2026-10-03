import { useState } from "react";
import { Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { IconUserPlus } from "@tabler/icons-react";

// First-run administrator setup. Only rendered when the desktop database has no
// administrator; once created, LoginPage takes over. No default credentials
// exist anywhere: the account is created here and stored locally in SQLite.
export function SetupPage() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      notifications.show({
        color: "red",
        title: "Las contraseñas no coinciden",
        message: "Verificá que ambas sean iguales.",
        autoClose: 5000,
        withCloseButton: true,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const { token } = await api.createFirstAdmin({ name, email, password });
      localStorage.setItem("escuela-futbol-email", email);
      signIn(token);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No se pudo crear la cuenta",
        message: error instanceof ApiError ? error.message : "Intentá de nuevo.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack align="center" justify="center" mih="100vh" p="xl">
      <Paper withBorder radius="md" p="xl" w={360}>
        <Title order={2} mb="md">
          Configuración inicial
        </Title>
        <Text c="dimmed" mb="xl">
          Creá la cuenta administradora de esta computadora. Se guarda localmente
          y no se comparte con ningún servidor.
        </Text>
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <TextInput
              label="Nombre"
              placeholder="Nombre del administrador"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <TextInput
              label="Correo"
              placeholder="admin@escuelafutbol.local"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <PasswordInput
              label="Contraseña"
              description="Mínimo 8 caracteres."
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <PasswordInput
              label="Confirmar contraseña"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            />
            <Button type="submit" fullWidth leftSection={<IconUserPlus size={18} />} loading={isSubmitting}>
              Crear cuenta e ingresar
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
