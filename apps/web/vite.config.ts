import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
