import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

// White-label: rewrite the static parts of index.html at build time so the
// pre-JavaScript document belongs to THIS instance. That covers the <title>
// (first paint / SEO) and the share card — messaging apps read the raw HTML
// only, so a baked-in "Million Stay" would be what every tenant's shared link
// showed. Defaults to the primary instance. Spec §2.3.
const appName = process.env.VITE_APP_NAME?.trim() || "Million Stay";
const shareImage = process.env.VITE_LOGO_MARK_URL?.trim() || "/logo-mark.png";
const htmlAppName = {
  name: "html-app-name",
  transformIndexHtml(html: string) {
    return html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${appName}</title>`)
      .replace(
        /(<meta property="og:title" content=")[^"]*(")/,
        `$1${appName.replace(/"/g, "&quot;")}$2`,
      )
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${shareImage}$2`);
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