import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, copyFile, cp } from "node:fs/promises";

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
      "electron",
      "pdf-parse",
      "pdfjs-dist"
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: "import { createRequire as topLevelCreateRequire } from 'node:module';\nimport { fileURLToPath as topLevelFileURLToPath } from 'node:url';\nimport { dirname as topLevelDirname } from 'node:path';\nconst require = topLevelCreateRequire(import.meta.url);\nconst __filename = topLevelFileURLToPath(import.meta.url);\nconst __dirname = topLevelDirname(__filename);"
    }
  });
}

buildAll()
  .then(async () => {
    const src = path.resolve(artifactDir, "src/seed-migration.sql");
    const dest = path.resolve(artifactDir, "dist/seed-migration.sql");
    await copyFile(src, dest).catch(() => {});
    // 정부 배포 서식 PDF와 한글 폰트는 번들에 인라인할 수 없어 그대로 실어 나른다.
    // 런타임에서 __dirname(=dist) 옆의 forms/ 를 읽는다 → pdfFormOverlay.formAssetDir().
    await cp(
      path.resolve(artifactDir, "src/lib/documents/forms"),
      path.resolve(artifactDir, "dist/forms"),
      { recursive: true },
    ).catch(() => {});
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });