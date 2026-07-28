#!/usr/bin/env node
// Per-page translation coverage audit.
//
// Walks every source file in an app, extracts the i18n keys it references
// (t("..."), i18n.t("..."), <Trans i18nKey="...">), and reports, per file, how
// many of those keys have a value in the target locale. Keys that fall back to
// English are listed so they can be filled.
//
// Usage:
//   node scripts/audit-locale-coverage.mjs <lang> [app ...]
//   node scripts/audit-locale-coverage.mjs vi --verbose

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
const LANG = argv.find((a) => !a.startsWith("--")) || "vi";
const APPS = argv.filter((a) => !a.startsWith("--")).slice(1);
const DEFAULT_APPS = [
  "million-stay-web", "property-admin", "agent-portal", "owner-portal", "service-host-portal",
];
const apps = APPS.length ? APPS : DEFAULT_APPS;

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "locales") continue;
      walk(p, files);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
  }
  return files;
}

// t("a.b"), t('a.b'), t(`a.b`), i18n.t("a.b"), i18nKey="a.b"
const KEY_RE = /(?:\bt\(\s*|\bi18nKey\s*=\s*)(["'`])([A-Za-z0-9_$][\w.$-]*)\1/g;

let grandUsed = 0, grandCovered = 0;

for (const app of apps) {
  const localeDir = path.join(ROOT, "artifacts", app, "src", "locales");
  const enPath = path.join(localeDir, "en", "translation.json");
  const tgtPath = path.join(localeDir, LANG, "translation.json");
  if (!fs.existsSync(enPath)) { console.log(`\n### ${app}: no locales — skipped`); continue; }
  const en = flatten(JSON.parse(fs.readFileSync(enPath, "utf8")), "", {});
  const tgt = fs.existsSync(tgtPath)
    ? flatten(JSON.parse(fs.readFileSync(tgtPath, "utf8")), "", {})
    : {};

  const srcDir = path.join(ROOT, "artifacts", app, "src");
  const files = walk(srcDir);
  const rows = [];
  let appUsed = 0, appCovered = 0;

  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    const keys = new Set();
    for (const m of text.matchAll(KEY_RE)) {
      const k = m[2];
      // Only count keys that actually exist in the English source — this filters
      // out t(variable) misfires and unrelated single-word matches.
      if (typeof en[k] === "string") keys.add(k);
    }
    if (keys.size === 0) continue;
    const missing = [...keys].filter((k) => typeof tgt[k] !== "string" || tgt[k].trim() === "");
    rows.push({ file: path.relative(ROOT, f), used: keys.size, missing });
    appUsed += keys.size;
    appCovered += keys.size - missing.length;
  }

  rows.sort((a, b) => b.missing.length - a.missing.length || a.file.localeCompare(b.file));
  const pct = appUsed ? ((appCovered / appUsed) * 100).toFixed(1) : "100.0";
  console.log(`\n### ${app} — ${appCovered}/${appUsed} keys covered in "${LANG}" (${pct}%), ${rows.length} files`);
  const incomplete = rows.filter((r) => r.missing.length);
  if (incomplete.length === 0) {
    console.log("  ✓ every referenced key is translated");
  } else {
    console.log(`  ${incomplete.length} file(s) with fallback keys:`);
    for (const r of incomplete) {
      console.log(`   - ${r.file}: ${r.missing.length}/${r.used} missing`);
      if (VERBOSE) for (const k of r.missing) console.log(`       · ${k}`);
    }
  }
  grandUsed += appUsed;
  grandCovered += appCovered;
}

const pct = grandUsed ? ((grandCovered / grandUsed) * 100).toFixed(1) : "0";
console.log(`\n=== TOTAL: ${grandCovered}/${grandUsed} referenced keys covered in "${LANG}" (${pct}%)`);
