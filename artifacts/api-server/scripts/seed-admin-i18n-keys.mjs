/**
 * seed-admin-i18n-keys.mjs
 *
 * Publishes the property-admin resource bundles into the `translations` table
 * under the `admin.` namespace, so the admin console's own labels become
 * editable from Content → Page Translations → Admin Console.
 *
 * Model:
 *   - Every shipped locale is seeded, so an editor opening any language sees the
 *     wording the console currently shows instead of an empty field.
 *   - Seeded rows carry source="bundle". The runtime overlay skips those (they
 *     are identical to the JSON the app already ships), so a normal page load
 *     downloads only the values a human actually changed. Saving through the UI
 *     flips the row to source="human", which is what makes it take effect.
 *   - Re-runnable: values are refreshed from the bundle, human edits are left
 *     alone, and keys that no longer exist are pruned across every language.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/seed-admin-i18n-keys.mjs
 *   DATABASE_URL=... node scripts/seed-admin-i18n-keys.mjs --dry-run
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));
const LOCALES = join(__dir, "../../property-admin/src/locales");
const LANGS = ["en", "ko", "ja", "zh", "th", "vi"];
const PREFIX = "admin.";
const DRY = process.argv.includes("--dry-run");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

/** Flatten a nested resource object into dot-notation keys. */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

function bundleFor(lang) {
  const flat = flatten(JSON.parse(readFileSync(join(LOCALES, lang, "translation.json"), "utf8")));
  return new Map(Object.entries(flat).map(([k, v]) => [PREFIX + k, v]));
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  const enKeys = new Set(bundleFor("en").keys());

  for (const lang of LANGS) {
    const wanted = bundleFor(lang);
    const existing = await pool.query(
      `SELECT key, value, source FROM translations WHERE lang = $1 AND key LIKE $2`,
      [lang, PREFIX + "%"],
    );
    const have = new Map(existing.rows.map((r) => [r.key, r]));

    // Human edits win — never overwrite what somebody typed in the UI.
    const rows = [...wanted].filter(([k, v]) => {
      const row = have.get(k);
      return !row || (row.source !== "human" && row.value !== v);
    });
    const edited = [...have.values()].filter((r) => r.source === "human").length;

    console.log(`${lang}: bundle ${wanted.size} · write ${rows.length} · human-edited kept ${edited}`);
    if (DRY) continue;

    // Chunked upsert — one statement per 500 keys keeps the parameter count sane.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const values = chunk.map((_, n) => `($${n * 3 + 1}, $${n * 3 + 2}, $${n * 3 + 3}, 'bundle')`).join(",");
      await pool.query(
        `INSERT INTO translations (lang, key, value, source) VALUES ${values}
         ON CONFLICT (lang, key) DO UPDATE
           SET value = EXCLUDED.value, source = 'bundle', updated_at = now()
           WHERE translations.source <> 'human'`,
        chunk.flatMap(([k, v]) => [lang, k, v]),
      );
    }
  }

  // Keys that left the English bundle are dead everywhere.
  const all = await pool.query(`SELECT DISTINCT key FROM translations WHERE key LIKE $1`, [PREFIX + "%"]);
  const stale = all.rows.map((r) => r.key).filter((k) => !enKeys.has(k));
  if (stale.length > 0 && !DRY) {
    await pool.query(`DELETE FROM translations WHERE key = ANY($1::text[])`, [stale]);
  }
  console.log(`Pruned ${stale.length} dead keys${DRY ? " (dry run)" : ""}.`);

  const total = await pool.query(
    `SELECT lang, count(*)::int AS n FROM translations WHERE key LIKE $1 GROUP BY lang ORDER BY lang`,
    [PREFIX + "%"],
  );
  console.log("Done:", total.rows.map((r) => `${r.lang}=${r.n}`).join(" "));
} finally {
  await pool.end();
}
