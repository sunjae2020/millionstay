import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, copyFile } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "bcrypt",
      "fsevents",
      "lightningcss",
      "pg-native",
      "@prisma/client",
      "@swc/core",
      "playwright",
      "puppeteer",
      "electron"
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ]
  });
}

buildAll()
  .then(async () => {
    const src = path.resolve(artifactDir, "src/seed-migration.sql");
    const dest = path.resolve(artifactDir, "dist/seed-migration.sql");
    await copyFile(src, dest).catch(() => {});
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });