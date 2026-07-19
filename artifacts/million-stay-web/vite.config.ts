import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

// White-label: replace the static index.html <title> at build time so the
// initial (pre-JS) title matches the instance name too (SEO/first paint).
// Defaults to "Million Stay" for the primary instance. Spec §2.3.
const appName = process.env.VITE_APP_NAME?.trim() || "Million Stay";
const htmlAppName = {
  name: "html-app-name",
  transformIndexHtml(html: string) {
    return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${appName}</title>`);
  },
};

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), htmlAppName],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      ],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});