import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Tauri injects TAURI_ENV_PLATFORM when running beforeBuildCommand/beforeDevCommand.
// The desktop app must never ship a service worker: a stale SW/Cache Storage in
// WebView2 served old frontend assets while the executable was already updated
// (v0.3.5 binary showing a v0.3.1 UI). Desktop-safe builds therefore skip PWA
// generation entirely; ordinary web dev/build keeps the PWA behavior.
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: isTauriBuild,
      registerType: "autoUpdate",
      manifest: {
        name: "Escuela Futbol",
        short_name: "Escuela Futbol",
        description: "Gestión de mensualidades para la escuela de fútbol",
        theme_color: "#1D4ED8",
        background_color: "#F8FAFC",
        display: "standalone",
        icons: [],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
