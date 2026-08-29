import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "drink-water 喝水記錄",
        short_name: "drink-water",
        description: "手機優先、保存最近七天紀錄的本機喝水工具。",
        lang: "zh-Hant",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#e8f4f1",
        theme_color: "#f6faf9",
        categories: ["health", "lifestyle"],
        icons: [
          {
            src: `${base}icons/pwa-192x192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${base}icons/pwa-512x512.png`,
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: `${base}icons/pwa-maskable-512x512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,ico}"],
        importScripts: ["push-handler.js"],
        navigateFallback: "index.html",
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: "jsdom",
  },
});
