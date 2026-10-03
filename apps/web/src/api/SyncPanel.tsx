import { Stack, Text } from "@mantine/core";

// Local-only status panel: the desktop app never synchronizes with a server,
// so there is no last-sync time, no pending queue, and no refresh action here.
export function SyncPanel() {
  return <Stack gap="xs">
    <Text size="sm">Modo local · Los datos se guardan en esta computadora.</Text>
    <Text size="xs" c="dimmed">Jugadores, pagos e historiales se consultan y registran localmente. No se requiere conexión a internet.</Text>
  </Stack>;
}
