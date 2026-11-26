import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { brand } from "../../packages/core/src/brand.ts";

export default defineConfig({
  define: {
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(
      process.env["DEV_CLERK_PUBLISHABLE_KEY"] ?? "",
    ),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      process.env["VITE_API_BASE_URL"] ?? "",
    ),
    "import.meta.env.VITE_FARO_COLLECTOR_URL": JSON.stringify(
      process.env["VITE_FARO_COLLECTOR_URL"] ?? "",
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "brand-html",
      transformIndexHtml: (html) => html.replaceAll("%BRAND_NAME%", brand.name),
    },
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: brand.name,
        short_name: brand.name,
        description: brand.tagline,
        start_url: "/",
        display: "standalone",
        theme_color: "#0b2545",
        background_color: "#ffffff",
        icons: [],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
        navigateFallback: "index.html",
        runtimeCaching: [],
        importScripts: ["push-sw.js"],
      },
    }),
  ],
});
