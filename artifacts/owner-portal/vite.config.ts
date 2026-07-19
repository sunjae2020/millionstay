import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5176;
const basePath = process.env.BASE_PATH || "/";

// White-label: replace the static index.html <title> at build time so the
// initial (pre-JS) title matches the instance name too. Defaults to the
// primary "MillionStay Owner Portal" title.
const appName = process.env.VITE_APP_NAME?.trim() || "MillionStay Owner Portal";
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
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
