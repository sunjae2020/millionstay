#!/usr/bin/env node
/**
 * Create the media-library folders for an instance in Cloudinary.
 *
 * The library browses `<CLOUDINARY_ROOT_FOLDER>/<folder>`; Cloudinary only
 * materialises a folder once something is uploaded into it, so a brand-new
 * sub-folder shows up empty-and-missing in the Media Explorer until it is
 * created explicitly. This script does that, idempotently.
 *
 * Usage:
 *   node scripts/create-media-folders.mjs                          # uses artifacts/api-server/.env
 *   node scripts/create-media-folders.mjs --env .env.metheim       # another instance
 *   node scripts/create-media-folders.mjs --dry-run
 */
// Uses Cloudinary's Admin REST API directly (Basic auth) so the script runs
// from the repo root without resolving the workspace `cloudinary` package.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(__dirname, "..", "artifacts", "api-server");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const envIdx = argv.indexOf("--env");
const envFile = envIdx >= 0 ? argv[envIdx + 1] : ".env";

// Keep in sync with CONTENT_SUBFOLDERS in artifacts/api-server/src/routes/media.ts.
const FOLDERS = [
  "content",
  "content/brand",
  "content/hero",
  "content/programs",
  "content/team",
  "content/gallery",
  "content/blog",
  "content/icons",
  "spaces",
  "listings",
  "branding",
];

function loadEnv(file) {
  const full = path.isAbsolute(file) ? file : path.join(API_DIR, file);
  if (!fs.existsSync(full)) throw new Error(`env file not found: ${full}`);
  const out = {};
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(envFile);
const cloudName = env.CLOUDINARY_CLOUD_NAME;
const apiKey = env.CLOUDINARY_API_KEY;
const apiSecret = env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
  console.error(`[media-folders] ${envFile} has no Cloudinary credentials — nothing to do.`);
  process.exit(1);
}
const root = (env.CLOUDINARY_ROOT_FOLDER || "millionstay").trim();
const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

console.log(`[media-folders] cloud=${cloudName} root=${root}${dryRun ? " (dry run)" : ""}`);
let ok = 0;
for (const sub of FOLDERS) {
  const full = `${root}/${sub}`;
  if (dryRun) {
    console.log(`  would create ${full}`);
    continue;
  }
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/folders/${full
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: auth } });
  const body = await res.json().catch(() => ({}));
  // Creating an existing folder answers 200 with success:false — still "present".
  if (res.ok) {
    console.log(`  ok ${full}${body?.success === false ? " (already existed)" : ""}`);
    ok += 1;
  } else {
    console.error(`  FAILED ${full}: ${res.status} ${body?.error?.message ?? ""}`);
    process.exitCode = 1;
  }
}
if (!dryRun) console.log(`[media-folders] done — ${ok}/${FOLDERS.length} folders present`);
