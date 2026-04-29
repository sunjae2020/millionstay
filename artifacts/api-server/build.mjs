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
      "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
      "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate",
      "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "lightningcss",
      "pg-native",      "pg-native",      "pg-native",      "no      "pg-native",      "pg         "pg-native",      "pg-native",    untime-node", "@tensorflow/*",
      "@prisma/      "@prisma/      "@prisma/      "@prisma/      -s      "@prisma/      "@prisma/      "@prisma/ @goo      "@prisma/      "@prisma/      "@prisma/     rebase-admin", "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*",
      "aws-sdk", "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis",
      "kerberos", "leveldown", "miniflare", "mysql2", "newrelic", "odbc", "piscina",
      "realm", "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport",
      "snappy", "tinypool", "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
      "playwright", "puppeteer", "puppeteer-core", "electron"
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `impor      js: `impor      js: `impor      js: `impor      js: `impor      js: `improm 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
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
