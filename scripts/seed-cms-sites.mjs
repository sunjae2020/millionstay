#!/usr/bin/env node
// Fill the CMS site registry and design tokens for ONE tenant instance.
//
// `cms_sites` ships blank (0037 seeds keys only) because a label, a public host
// and a palette are tenant facts, not product facts — an instance must never
// show another tenant's brand or domain. This script reads
// tenants/<name>/config.env and writes those facts into the instance's DB.
//
// Usage:
//   DATABASE_URL=... node scripts/seed-cms-sites.mjs metheim [--apply]
//
// Without --apply it prints what it would change and touches nothing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { guardDbInstance } from "./lib/dbGuard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TENANT = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!TENANT) {
  console.error("usage: seed-cms-sites.mjs <tenant> [--apply]");
  process.exit(1);
}

const CFG = path.join(ROOT, "tenants", TENANT, "config.env");
if (!fs.existsSync(CFG)) {
  console.error(`no config for tenant "${TENANT}" (${CFG})`);
  process.exit(1);
}

/** Parse config.env the same way the deploy scripts do: split on the first '='. */
function readConfig(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/** "190 100% 23%" (the brand.css primitive format) → "#005f73". */
function hslToHex(triplet) {
  const m = String(triplet).trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c);
  };
  const hex = (v) => v.toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

/** Rough luminance test so text stays readable on each background role. */
function textOn(hex) {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#12232B" : "#FFFFFF";
}

const cfg = readConfig(CFG);
const appName = cfg.VITE_APP_NAME || TENANT;
const siteMode = (cfg.VITE_SITE_MODE || "").toLowerCase();

// The public web host. Tenants either run their own domain or the Vercel
// project <tenant>-web; config.env may state it explicitly.
const webHost =
  cfg.VITE_PUBLIC_WEB_URL ||
  cfg.VITE_WEB_URL ||
  (TENANT === "million" ? "https://millionstay.com.au" : `https://${TENANT}-web.vercel.app`);

// A "development"-mode instance (Metheim) runs only the development site; the
// guest and homestay sites do not exist there and are hidden rather than shown
// with someone else's domain.
const devOnly = siteMode === "development";

const SITES = [
  {
    site_key: "www",
    label: devOnly ? `${appName} (게스트)` : appName,
    host: devOnly ? null : webHost,
    is_active: !devOnly,
  },
  {
    site_key: "homestay",
    label: `${appName} Homestay`,
    host: devOnly ? null : cfg.VITE_HOMESTAY_URL || null,
    is_active: !devOnly && String(cfg.HOMESTAY_MODULE_ENABLED ?? "true") !== "false",
  },
  {
    site_key: "dev",
    label: appName,
    host: devOnly ? webHost : cfg.VITE_DEV_SITE_URL || null,
    is_active: devOnly,
  },
];

// Palette from the tenant's brand primitives (tenants/<name>/config.env is the
// single source of truth for brand colour — same values generate-brand.mjs uses).
const palette = {
  primary: hslToHex(cfg.BRAND_ORANGE) || "#E8621A",
  accent: hslToHex(cfg.BRAND_TEAL) || "#0F9B8E",
  ink: hslToHex(cfg.BRAND_NAVY) || "#16263F",
  surface: hslToHex(cfg.BRAND_CREAM) || "#FAF5EC",
  muted: hslToHex(cfg.BRAND_APRICOT) || "#F1F1F0",
};
const tokens = {
  palette,
  onPalette: Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, textOn(v)])),
  fontPair: "pretendard-inter",
  radiusScale: "soft",
  spacingScale: "regular",
  headingScale: "regular",
};

console.log(`tenant: ${TENANT} (${appName})${devOnly ? " — development-mode instance" : ""}`);
for (const site of SITES) {
  console.log(`  ${site.site_key.padEnd(9)} label="${site.label}" host=${site.host ?? "—"} active=${site.is_active}`);
}
console.log(`  palette: ${Object.entries(palette).map(([k, v]) => `${k}=${v}`).join("  ")}`);

if (!APPLY) {
  console.log("\ndry run — pass --apply to write");
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}
guardDbInstance({ databaseUrl: url });
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("supabase.") ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const site of SITES) {
    await client.query(
      `UPDATE cms_sites SET label = $2, host = $3, is_active = $4, updated_at = now()
         WHERE site_key = $1`,
      [site.site_key, site.label, site.host, site.is_active],
    );
    await client.query(
      `INSERT INTO cms_site_settings (site_key, design_tokens)
            VALUES ($1, $2::jsonb)
       ON CONFLICT (site_key) DO UPDATE SET design_tokens = $2::jsonb, updated_at = now()`,
      [site.site_key, JSON.stringify(tokens)],
    );
  }
  await client.query("COMMIT");
  console.log("\napplied");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("failed, rolled back:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
