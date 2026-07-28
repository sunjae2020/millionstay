#!/usr/bin/env node
// Fill gaps in the DB-backed `translations` table for one language.
//
// The guest/landing sites overlay admin-managed strings from `translations` on
// top of the bundled JSON. When a new language is enabled, the English rows
// exist but the target-language rows don't — this script finds those gaps,
// translates them with Claude, and emits an idempotent SQL upsert file.
//
// It never overwrites a non-empty existing value, and it only writes SQL to
// stdout/a file — apply it yourself with psql after review.
//
// Usage:
//   node scripts/translate-db-lang.mjs <env-file> <lang> <out.sql>
//   e.g. node scripts/translate-db-lang.mjs artifacts/api-server/.env vi /tmp/vi.sql

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ENV_FILE = process.argv[2];
const LANG = process.argv[3];
const OUT = process.argv[4];
if (!ENV_FILE || !LANG || !OUT) {
  console.error("usage: translate-db-lang.mjs <env-file> <lang> <out.sql>");
  process.exit(1);
}

const LANG_INFO = {
  ko: { name: "Korean", style: "Use polite formal Korean (합쇼체)." },
  zh: { name: "Simplified Chinese", style: "Use formal Simplified Chinese." },
  ja: { name: "Japanese", style: "Use polite formal Japanese (です/ます体)." },
  th: { name: "Thai", style: "Use formal, polite Thai." },
  vi: { name: "Vietnamese", style: "Use formal Vietnamese." },
};
const info = LANG_INFO[LANG] ?? { name: LANG, style: "Use formal, natural language." };

function envValue(file, key) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.+?)\\s*$`).exec(line);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return null;
}

const API_KEY =
  process.env.ANTHROPIC_API_KEY || envValue(path.join(ROOT, ".env.local"), "ANTHROPIC_API_KEY");
if (!API_KEY) { console.error("ANTHROPIC_API_KEY not found"); process.exit(1); }

// Strip driver-only query params psql rejects.
const DB_URL = envValue(path.join(ROOT, ENV_FILE), "DATABASE_URL")
  .replace(/[?&]uselibpqcompat=[^&]*/g, "")
  .replace(/[?&]sslnegotiation=[^&]*/g, "");

// English rows without a non-empty row in the target language.
const sql = `
SELECT json_agg(json_build_object('key', e.key, 'en', e.value))
FROM translations e
LEFT JOIN translations t ON t.lang = '${LANG}' AND t.key = e.key
WHERE e.lang = 'en' AND e.value <> '' AND (t.id IS NULL OR btrim(t.value) = '');
`;
const raw = execFileSync("psql", [DB_URL, "-At", "-c", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const missing = raw ? JSON.parse(raw) : [];
console.log(`${ENV_FILE} → ${LANG}: ${missing.length} missing keys`);
if (missing.length === 0) { fs.writeFileSync(OUT, "-- nothing to do\n"); process.exit(0); }

const SYSTEM = `You are a professional software localisation translator for MillionStay, a property-management SaaS (bookings, contracts, invoices, tenants, properties) and its public marketing website.
Target language: ${info.name}. ${info.style}

Rules:
- Translate the VALUES only; never change the keys.
- Preserve placeholders exactly: {{name}}, {name}, %s, and any HTML tags.
- Do not translate brand names, product names, currency codes, or technical identifiers.
- Marketing copy should read as natural, persuasive ${info.name} — not a literal word-for-word rendering.
- Return ONLY a JSON object mapping every input key to its translated string. No prose, no code fences.`;

const BATCH = 20;
const CONCURRENCY = 4;

async function translateBatch(items, attempt = 0) {
  const payload = Object.fromEntries(items.map((i) => [i.key, i.en]));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.TRANSLATE_MODEL || "claude-sonnet-5",
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) {
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return translateBatch(items, attempt + 1);
    }
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  let text = (json.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  text = text.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    if (attempt < 3 && items.length > 1) {
      // Split and retry — a long string may have truncated the response.
      const mid = Math.ceil(items.length / 2);
      const [a, b] = await Promise.all([
        translateBatch(items.slice(0, mid), attempt + 1),
        translateBatch(items.slice(mid), attempt + 1),
      ]);
      return { ...a, ...b };
    }
    if (attempt < 3) return translateBatch(items, attempt + 1);
    throw new Error("unparseable response");
  }
  return parsed;
}

const batches = [];
for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));

const results = {};
let done = 0;
const queue = [...batches];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
    while (queue.length) {
      const b = queue.shift();
      try { Object.assign(results, await translateBatch(b)); }
      catch (e) { console.error(`\n  ! batch failed: ${e.message}`); }
      process.stdout.write(`\r  ${++done}/${batches.length} batches`);
    }
  }),
);
process.stdout.write("\n");

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const lines = [
  "BEGIN;",
  `-- ${LANG} translations generated by scripts/translate-db-lang.mjs (source='machine')`,
];
let n = 0;
for (const { key } of missing) {
  const v = results[key];
  if (typeof v !== "string" || v.trim() === "") continue;
  lines.push(
    `INSERT INTO translations (lang, key, value, source) VALUES (${q(LANG)}, ${q(key)}, ${q(v)}, 'machine')`,
    `  ON CONFLICT (lang, key) DO UPDATE SET value = EXCLUDED.value, source = 'machine', reviewed_at = NULL, updated_at = now()`,
    `  WHERE btrim(translations.value) = '';`,
  );
  n++;
}
lines.push("COMMIT;");
fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`wrote ${OUT} — ${n}/${missing.length} keys translated`);
