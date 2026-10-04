import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "dayjs/locale/es";
import "./print.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { App } from "./App";
import { theme } from "./theme";
import { isDesktop } from "./api/desktop";

// Desktop (Tauri) builds must never keep stale frontend assets. Older releases
// shipped a service worker + Cache Storage entries in WebView2, which kept
// serving the old UI after an update (v0.3.5 binary showing a v0.3.1 header).
// On startup inside Tauri, unregister any existing service workers and clear
// Cache Storage; if anything was removed, reload once so the packaged frontend
// loads fresh assets. sessionStorage guards against a reload loop, and all
// browser APIs are feature-detected.
const CACHE_CLEAR_FLAG = "escuela-sw-cache-cleared";

async function clearStaleDesktopCache(): Promise<boolean> {
  if (!isDesktop) return false;
  let removed = false;

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        removed = (await registration.unregister()) || removed;
      }
    } catch {
      // Best effort: never block startup on cache cleanup.
    }
  }

  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        removed = (await caches.delete(key)) || removed;
      }
    } catch {
      // Best effort: never block startup on cache cleanup.
    }
  }

  return removed;
}

function reloadAlreadyHappened(): boolean {
  try {
    return sessionStorage.getItem(CACHE_CLEAR_FLAG) === "1";
  } catch {
    return false;
  }
}

function markReload() {
  try {
    sessionStorage.setItem(CACHE_CLEAR_FLAG, "1");
  } catch {
    // If sessionStorage is unavailable, the reload loop guard is weaker, but
    // the second pass finds nothing to remove and will not reload again.
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
        <DatesProvider settings={{ locale: "es" }}>
          <Notifications position="top-right" />
          <App />
        </DatesProvider>
      </MantineProvider>
    </React.StrictMode>,
  );
}

clearStaleDesktopCache().then((removed) => {
  if (removed && !reloadAlreadyHappened()) {
    markReload();
    window.location.reload();
    return;
  }
  renderApp();
});
