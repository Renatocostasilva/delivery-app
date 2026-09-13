import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Delivery App",
        short_name: "Delivery",
        description: "Aplicativo de delivery mobile-first",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // Permite acesso via túnel público (trycloudflare.com) em dev.
    allowedHosts: true,
    // /api é proxeado para o backend (evita mixed-content).
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});