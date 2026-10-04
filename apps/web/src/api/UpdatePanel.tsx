import { useEffect, useRef, useState } from "react";
import { Button, Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { desktop, isDesktop } from "./desktop";

// The updater plugin reports the target platform only on the backend, so
// detect Windows in the frontend from the user agent before deciding whether
// an automatic relaunch is safe.
const isWindows = typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

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
    if (isDesktop) {
      // Data preservation comes first: checkpoint the local database outside
      // the app-data directory before the installer can touch it.
      setMessage("Guardando una copia de seguridad de tus datos…");
      try {
        await desktop.backupLocalData();
      } catch {
        setMessage("No se pudo crear la copia de seguridad de tus datos, así que la actualización no se inició para proteger tu información. Intentá de nuevo o contactá al administrador.");
        locked.current = false;
        setBusy(false);
        return;
      }
    }
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
      if (isWindows) {
        // Windows (NSIS): the installer may still be replacing files while
        // the app is running. An immediate relaunch() can start the old
        // binary (the updater reported v0.3.3 but the app stayed on v0.3.1),
        // so never restart automatically here. The installer finishes when
        // the app closes, and the user reopens it manually.
        setMessage("Actualización instalada. Para completar la instalación en Windows: cerrá la aplicación completamente, esperá a que el instalador finalice y volvé a abrirla manualmente.");
      } else {
        // The updater plugin installs the new binaries but only relaunch() runs
        // them, so restart automatically instead of asking the user to do it.
        setMessage("Actualización instalada. La aplicación se va a reiniciar para completar la instalación…");
        try {
          await relaunch();
        } catch {
          setMessage("Actualización instalada. No se pudo reiniciar automáticamente: cerrá la aplicación completamente y volvé a abrirla.");
        }
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
            <Text size="sm">Guardá tu trabajo antes de continuar. Primero se guarda una copia de seguridad de tus datos fuera de la carpeta de la aplicación{isWindows ? "; después de instalar, cerrá la aplicación completamente, esperá a que el instalador de Windows finalice y volvé a abrirla manualmente" : ", después de instalar la aplicación se reinicia sola"}. Tus datos locales se conservan.</Text>
            <Group justify="flex-end">
              <Button variant="default" disabled={busy} onClick={() => setOpened(false)}>Ahora no</Button>
              <Button loading={busy} onClick={() => void install()}>Confirmar e instalar</Button>
            </Group>
          </>}
          {installed && !isWindows && <Button onClick={() => {
            // Fallback when the automatic relaunch after install did not run.
            // Not rendered on Windows: relaunching there can race the NSIS
            // installer and start the old binary, so Windows only shows the
            // manual close/reopen instruction.
            void relaunch().catch(() => setMessage("Actualización instalada. No se pudo reiniciar automáticamente: cerrá la aplicación completamente y volvé a abrirla."));
          }}>Reiniciar aplicación</Button>}
        </Stack>
      </Modal>
    </>
  );
}
