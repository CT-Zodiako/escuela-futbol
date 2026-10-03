import { useState } from "react";
import { Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { IconLogin } from "@tabler/icons-react";

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(
    () => localStorage.getItem("escuela-futbol-email") ?? "",
  );
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const { token } = await api.login(email, password);
      localStorage.setItem("escuela-futbol-email", email);
      signIn(token);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No se pudo iniciar sesión",
        message: error instanceof ApiError ? error.message : "Credenciales inválidas.",
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
          Escuela Futbol
        </Title>
        <Text c="dimmed" mb="xl">
          Ingresá para gestionar jugadores y mensualidades.
        </Text>
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
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
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <Button type="submit" fullWidth leftSection={<IconLogin size={18} />} loading={isSubmitting}>
              Ingresar
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
