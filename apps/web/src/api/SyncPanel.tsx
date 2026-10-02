import { useEffect, useState } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { refreshSnapshot } from "./client";
import { desktop, syncError, syncEvents } from "./desktop";

export function SyncPanel({ onRefresh }: { onRefresh: () => void }) {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(syncError);
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      setError(syncError);
      void desktop.status().then((status) => {
        if (active) setLastSync(status.generatedAt);
      }).catch((reason) => { if (active) setError(String(reason)); });
    };
    const synced = () => { update(); onRefresh(); };
    const connection = () => setOnline(navigator.onLine);
    update();
    syncEvents.addEventListener("change", synced);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      active = false;
      syncEvents.removeEventListener("change", synced);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [onRefresh]);

  return <Stack gap="xs">
    <Group justify="space-between">
      <Text size="sm">
        Consulta local · {online ? "Red disponible" : "Sin conexión"} · Última sincronización: {lastSync ? new Date(lastSync).toLocaleString() : "Nunca — descargá los datos en línea"}
      </Text>
      <Button loading={busy} disabled={!online} onClick={async () => {
        setBusy(true);
        try { await refreshSnapshot(); } catch { /* syncEvents exposes the failure */ }
        finally { setBusy(false); }
      }}>Actualizar datos</Button>
    </Group>
    <Text size="xs" c="dimmed">Solo lectura. Altas y cambios se realizan en la web; reportes requieren conexión. Los datos locales no cambian hasta actualizar.</Text>
    {error && <Text size="sm" c="red" role="alert">No se pudo sincronizar: {error} Se conserva la última descarga completa.</Text>}
  </Stack>;
}
