import { useEffect, useRef, useState } from "react";
import { Button, Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export function UpdatePanel() {
  const update = useRef<Update | null>(null);
  const mounted = useRef(false);
  const locked = useRef(false);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(() =>
    import.meta.env.VITE_APP_VERSION?.replace(/^v/, "") || null,
  );
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    void getVersion().then((value) => {
      if (mounted.current) setAppVersion(value);
    }).catch(() => undefined);
    void probeUpdate();
    return () => {
      mounted.current = false;
      if (!locked.current) void update.current?.close().catch(() => {});
    };
  }, []);

  async function probeUpdate() {
    try {
      const result = await check();
      if (!mounted.current) {
        await result?.close();
        return;
      }
      update.current = result;
      setVersion(result?.version ?? null);
    } catch {
      // Automatic checks are silent; the manual button shows the error.
    }
  }

  async function checkUpdate() {
    if (locked.current) return;
    locked.current = true;
    setOpened(true);
    setBusy(true);
    setVersion(null);
    setProgress(null);
    setMessage("Buscando actualizaciones…");
    try {
      await update.current?.close();
      update.current = null;
      const result = await check();
      if (!mounted.current) {
        await result?.close();
        return;
      }
      update.current = result;
      setVersion(result?.version ?? null);
      setMessage(result ? "Hay una actualización disponible." : "Ya tenés la última versión.");
    } catch {
      setMessage("No se pudo buscar actualizaciones. Revisá la conexión e intentá de nuevo.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function install() {
    if (locked.current || !update.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("Descargando actualización…");
    let downloaded = 0;
    let total = 0;
    try {
      await update.current.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setProgress(total ? Math.min(100, downloaded / total * 100) : null);
          setMessage(`Descargando: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
        }
        if (event.event === "Finished") {
          setProgress(100);
          setMessage("Descarga completa. Verificando e instalando…");
        }
      });
      setInstalled(true);
      setMessage("Actualización instalada. Reiniciando…");
      try {
        await relaunch();
      } catch {
        setMessage("Actualización instalada. Cerrá y abrí la aplicación o intentá reiniciar.");
      }
    } catch {
      setMessage("No se pudo instalar la actualización. Revisá la conexión o contactá al administrador. Podés intentarlo de nuevo.");
    } finally {
      locked.current = false;
      setBusy(false);
      if (!mounted.current) void update.current?.close().catch(() => {});
    }
  }

  return (
    <>
      <Text size="sm" c="dimmed">v{appVersion ?? "…"}</Text>
      <Button
        variant={version ? "light" : "subtle"}
        color={version ? "blue" : undefined}
        size="compact-sm"
        onClick={() => {
          if (installed) setOpened(true);
          else void checkUpdate();
        }}
      >
        {version ? "Actualización disponible" : "Actualizaciones"}
      </Button>
      <Modal opened={opened} onClose={() => { if (!busy) setOpened(false); }}
        title="Actualizaciones" closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy}>
        <Stack>
          <Text role="status" aria-live="polite">{message}</Text>
          {version && <Text fw={600}>Versión disponible: {version}</Text>}
          {busy && <Progress value={progress ?? 100} animated aria-label="Progreso de actualización" />}
          {version && !installed && <>
            <Text size="sm">Versión actual: <strong>v{appVersion ?? "—"}</strong></Text>
            <Text size="sm">Guardá tu trabajo antes de continuar. La aplicación se cerrará y reiniciará para instalar. Tus datos locales se conservan.</Text>
            <Group justify="flex-end">
              <Button variant="default" disabled={busy} onClick={() => setOpened(false)}>Ahora no</Button>
              <Button loading={busy} onClick={() => void install()}>Confirmar e instalar</Button>
            </Group>
          </>}
          {installed && <Button onClick={() => {
            void relaunch().catch(() => setMessage("Cerrá y abrí la aplicación para completar la actualización."));
          }}>Reiniciar aplicación</Button>}
        </Stack>
      </Modal>
    </>
  );
}
