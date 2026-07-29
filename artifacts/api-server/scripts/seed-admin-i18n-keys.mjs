/**
 * seed-admin-i18n-keys.mjs
 *
 * Publishes the property-admin English resource bundle into the `translations`
 * table under the `admin.` namespace, so the admin console's own labels become
 * editable from Content → Page Translations → Admin Console.
 *
 * Model:
 *   - Only the English rows are seeded. They are the reference column in the
 *     editor and the source text the AI-translate button works from.
 *   - Other languages stay absent until somebody saves an override. The console
 *     overlays `admin.*` rows on top of its bundled JSON, so "no row" means
 *     "use the shipped translation" — nothing changes until an editor types.
 *   - Re-runnable: values are refreshed from the bundle and keys that no longer
 *     exist are pruned (across every language, since they are dead keys).
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
const EN_JSON = join(__dir, "../../property-admin/src/locales/en/translation.json");
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

const bundle = flatten(JSON.parse(readFileSync(EN_JSON, "utf8")));
const wanted = new Map(Object.entries(bundle).map(([k, v]) => [PREFIX + k, v]));
console.log(`Bundle: ${wanted.size} admin keys from ${EN_JSON}`);

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  const existing = await pool.query(
    `SELECT key, value FROM translations WHERE lang = 'en' AND key LIKE $1`,
    [PREFIX + "%"],
  );
  const have = new Map(existing.rows.map((r) => [r.key, r.value]));

  const toInsert = [...wanted].filter(([k]) => !have.has(k));
  const toUpdate = [...wanted].filter(([k, v]) => have.has(k) && have.get(k) !== v);
  const stale = [...have.keys()].filter((k) => !wanted.has(k));

  console.log(`Insert ${toInsert.length} · update ${toUpdate.length} · prune ${stale.length}`);
  if (DRY) {
    for (const k of stale.slice(0, 20)) console.log(`  stale: ${k}`);
    process.exit(0);
  }

  // Chunked upsert — one statement per 500 keys keeps the parameter count sane.
  const rows = [...toInsert, ...toUpdate];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((_, n) => `('en', $${n * 2 + 1}, $${n * 2 + 2}, 'human', now())`).join(",");
    await pool.query(
      `INSERT INTO translations (lang, key, value, source, reviewed_at) VALUES ${values}
       ON CONFLICT (lang, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      chunk.flatMap(([k, v]) => [k, v]),
    );
    console.log(`  upserted ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }

  if (stale.length > 0) {
    await pool.query(`DELETE FROM translations WHERE key = ANY($1::text[])`, [stale]);
    console.log(`  pruned ${stale.length} dead keys (all languages)`);
  }

  const total = await pool.query(`SELECT count(*)::int AS n FROM translations WHERE key LIKE $1`, [PREFIX + "%"]);
  console.log(`Done. ${total.rows[0].n} admin.* rows in translations.`);
} finally {
  await pool.end();
}
