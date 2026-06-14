#!/usr/bin/env node
// One-time seeding for the landing-page i18n translations table.
//
// 1. Reads the bundled English source (million-stay-web en/translation.json),
//    flattens the keys under a namespace (default: "homestay"), and upserts each
//    one into the `translations` table as the English (lang=en) reference.
// 2. Calls the admin AI-translate endpoint (Anthropic) to fill every enabled
//    non-English language for that namespace. overwrite=false, so any value a
//    human already edited is preserved.
//
// After this runs once, day-to-day translation happens from the admin
// "Page Translations" editor. Re-running is safe (idempotent for English;
// AI step skips keys that already have a value).
//
// Usage:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/translate-i18n.mjs [namespace]
//   API_BASE defaults to http://localhost:8080
//
// The api-server must be running and have ANTHROPIC_API_KEY configured.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || "http://localhost:8080";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@millionstay.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MillionStay@2026!";
const NAMESPACE = process.argv[2] || "homestay";

const EN_PATH = path.resolve(
  __dirname,
  "../artifacts/million-stay-web/src/locales/en/translation.json",
);

async function api(method, p, body, token) {
  const res = await fetch(`${API_BASE}${p}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

// Flatten nested JSON into dot-notation, keeping only string leaves.
function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

async function main() {
  console.log(`=== i18n seeding for namespace "${NAMESPACE}" ===\n`);

  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
  const flat = flatten(en, "", {});
  const keys = Object.keys(flat).filter((k) => k === NAMESPACE || k.startsWith(NAMESPACE + "."));
  if (keys.length === 0) {
    console.error(`No bundled English keys found under "${NAMESPACE}".`);
    process.exit(1);
  }
  console.log(`Found ${keys.length} English source keys under "${NAMESPACE}".`);

  const { token } = await api("POST", "/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log("✓ Logged in\n");

  // Step 1: seed English reference values. Skip with SKIP_EN=1 when the English
  // source is already in the table (e.g. resuming after the AI step failed).
  if (process.env.SKIP_EN === "1") {
    console.log("=== Step 1: skipped (SKIP_EN=1) ===\n");
  } else {
    console.log("=== Step 1: seed English (lang=en) ===");
    let seeded = 0;
    for (const key of keys) {
      await api("PUT", "/api/v1/translations", { lang: "en", key, value: flat[key] }, token);
      seeded++;
      if (seeded % 50 === 0) console.log(`  …${seeded}/${keys.length}`);
    }
    console.log(`✓ Seeded ${seeded} English keys\n`);
  }

  // Step 2: AI-translate (or, with REVIEW=1, AI-review) every enabled non-English
  // language. Page-by-page (smaller, bounded requests) with limited concurrency,
  // rather than one giant request. Both endpoints are idempotent/resumable.
  const REVIEW = process.env.REVIEW === "1";
  const endpoint = REVIEW ? "/api/v1/translations/ai-review" : "/api/v1/translations/ai-translate";
  console.log(`=== Step 2: ${REVIEW ? "AI review" : "AI translate"} (Anthropic), page by page ===`);

  // Derive per-page prefixes. For a deep namespace (e.g. "homestay.home") just
  // translate it directly; for a top namespace ("homestay") split by sub-page.
  const depth = NAMESPACE.split(".").length;
  const prefixes = depth >= 2
    ? [NAMESPACE]
    : [...new Set(keys.map((k) => k.split(".").slice(0, 2).join(".")))].sort();

  const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
  const totals = {};
  const allErrors = [];
  let idx = 0;

  const metric = REVIEW ? "reviewed" : "translated";
  async function worker() {
    while (idx < prefixes.length) {
      const prefix = prefixes[idx++];
      try {
        const body = REVIEW ? { keyPrefix: prefix } : { keyPrefix: prefix, overwrite: false };
        const result = await api("POST", endpoint, body, token);
        const summary = result?.data?.summary ?? {};
        let line = `  ✓ ${prefix}:`;
        for (const [lang, s] of Object.entries(summary)) {
          totals[lang] = (totals[lang] ?? 0) + (s[metric] ?? 0);
          line += REVIEW ? ` ${lang}=${s.reviewed}(${s.changed}✎)` : ` ${lang}=${s.translated}`;
        }
        console.log(line);
        if (Array.isArray(result?.errors) && result.errors.length) allErrors.push(...result.errors.map((e) => ({ prefix, ...e })));
      } catch (e) {
        console.log(`  ✗ ${prefix}: ${e.message}`);
        allErrors.push({ prefix, message: e.message });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\n  Totals ${metric}:`, JSON.stringify(totals));
  if (allErrors.length) console.log("  errors:", JSON.stringify(allErrors).slice(0, 800));
  console.log("\n✓ Done. Review in Admin → Content → Page Translations.");
}

main().catch((e) => { console.error("\n✗ Failed:", e.message); process.exit(1); });
