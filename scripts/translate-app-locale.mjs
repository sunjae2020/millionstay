#!/usr/bin/env node
// Fill an app's bundled locale file from the English source using Claude.
//
// Unlike scripts/translate-i18n.mjs (which seeds the DB `translations` table for
// the guest site), this writes the bundled JSON under
// artifacts/<app>/src/locales/<lang>/translation.json — the resource files the
// portals and property-admin ship with.
//
// Only keys missing (or empty) in the target file are translated; existing
// values are preserved. Output key order mirrors the English source.
//
// Usage:
//   node scripts/translate-app-locale.mjs <app> <lang> [--all]
//   e.g. node scripts/translate-app-locale.mjs property-admin vi
//
// Requires ANTHROPIC_API_KEY (read from .env.local at the repo root if unset).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP = process.argv[2];
const LANG = process.argv[3];
const RETRANSLATE_ALL = process.argv.includes("--all");
if (!APP || !LANG) {
  console.error("usage: translate-app-locale.mjs <app> <lang> [--all]");
  process.exit(1);
}

const MODEL = process.env.TRANSLATE_MODEL || "claude-sonnet-5";
const BATCH_SIZE = Number(process.env.TRANSLATE_BATCH || 60);
const CONCURRENCY = Number(process.env.TRANSLATE_CONCURRENCY || 4);

const LANG_NAMES = {
  en: "English", ko: "Korean", ja: "Japanese", zh: "Simplified Chinese",
  th: "Thai", vi: "Vietnamese",
};

function loadEnvKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = /^\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return null;
}
const API_KEY = loadEnvKey();
if (!API_KEY) { console.error("ANTHROPIC_API_KEY not found"); process.exit(1); }

const localeDir = path.join(ROOT, "artifacts", APP, "src", "locales");
const enPath = path.join(localeDir, "en", "translation.json");
const outPath = path.join(localeDir, LANG, "translation.json");
if (!fs.existsSync(enPath)) { console.error(`missing ${enPath}`); process.exit(1); }

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

const flatEn = flatten(en, "", {});
const flatExisting = flatten(existing, "", {});

const todo = Object.keys(flatEn).filter((k) => {
  if (typeof flatEn[k] !== "string") return false;
  if (RETRANSLATE_ALL) return true;
  const cur = flatExisting[k];
  return typeof cur !== "string" || cur.trim() === "";
});

console.log(`${APP} → ${LANG}: ${Object.keys(flatEn).length} source keys, ${todo.length} to translate`);

const SYSTEM = `You are a professional software localisation translator.
You translate UI strings for MillionStay, a property-management SaaS (bookings, contracts, invoices, tenants, properties, partner portals).
Target language: ${LANG_NAMES[LANG] || LANG}.

Rules:
- Translate the VALUES only. Never change the keys.
- Preserve every placeholder exactly as-is: {{name}}, {name}, %s, {0}, and any HTML tags such as <b>, <br/>, <1>...</1>.
- Keep the string's role in mind: keys under "nav", "actions", "buttons" are short UI labels — keep them terse, not sentences.
- Do not translate brand names, product names, currency codes (KRW, AUD), or technical identifiers (API, CSV, PDF, URL, ID).
- Keep leading/trailing whitespace and trailing punctuation style of the source.
- Use natural, idiomatic ${LANG_NAMES[LANG] || LANG} that a native speaker would expect in a business application.
- Return ONLY a JSON object mapping every input key to its translated string. No prose, no code fences.`;

async function translateBatch(keys, attempt = 0) {
  const payload = {};
  for (const k of keys) payload[k] = flatEn[k];
  const body = {
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(payload, null, 0) }],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return translateBatch(keys, attempt + 1);
    }
    throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  let text = (json.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  text = text.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    if (attempt < 3) return translateBatch(keys, attempt + 1);
    throw new Error(`unparseable response for ${keys.length} keys`);
  }
  // Retry any keys the model dropped.
  const missing = keys.filter((k) => typeof parsed[k] !== "string");
  if (missing.length && attempt < 3) {
    const retry = await translateBatch(missing, attempt + 1);
    Object.assign(parsed, retry);
  }
  return parsed;
}

const batches = [];
for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE));

const results = {};
let done = 0;
async function worker(queue) {
  while (queue.length) {
    const batch = queue.shift();
    try {
      Object.assign(results, await translateBatch(batch));
    } catch (e) {
      console.error(`  ! batch failed: ${e.message}`);
    }
    done++;
    process.stdout.write(`\r  ${done}/${batches.length} batches`);
  }
}
const queue = [...batches];
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker(queue)));
if (batches.length) process.stdout.write("\n");

// Rebuild the file in English key order: translated value → existing value.
//
// Keys with no translation (a failed batch, or a value the model returned
// unchanged) are omitted rather than written as English: i18next's
// fallbackLng="en" renders the identical string anyway, and leaving the key out
// keeps the file resumable — a later re-run picks it up as still-missing.
const out = {};
for (const key of Object.keys(flatEn)) {
  const src = flatEn[key];
  if (typeof src !== "string") { setDeep(out, key, src); continue; }
  const cur = flatExisting[key];
  const keep = !RETRANSLATE_ALL && typeof cur === "string" && cur.trim() !== "";
  const value = keep ? cur : (results[key] ?? cur);
  if (typeof value !== "string" || value.trim() === "" || value === src) continue;
  setDeep(out, key, value);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

const flatOut = flatten(out, "", {});
const total = Object.keys(flatEn).filter((k) => typeof flatEn[k] === "string").length;
const covered = Object.keys(flatOut).length;
console.log(`wrote ${outPath}`);
console.log(`  ${covered}/${total} keys translated (${total - covered} fall back to English — re-run to fill)`);
