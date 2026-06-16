/**
 * One-off: upsert ko/ja/zh/th translations for all document_templates from
 * doc-template-translations.json, validate {{placeholder}} parity against the
 * en source, then re-publish each touched template.
 *
 * Idempotent: re-running overwrites the same locale rows with the same content.
 *
 * Run (writes to prod DB via api-server/.env):
 *   cd artifacts/api-server && node --env-file=.env \
 *     --import <root>/scripts/node_modules/tsx/dist/loader.mjs seed-doc-translations.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, pool, documentTemplatesTable, documentTemplateTranslationsTable } from "@workspace/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(__dirname, "doc-template-translations.json"), "utf8")) as Record<
  string,
  Record<string, { subject: string | null; body_html: string | null }>
>;
const LOCALES = ["ko", "ja", "zh", "th"];
const DRY = process.env.DRY === "1";

const placeholders = (s: string | null | undefined) =>
  [...(s ?? "").matchAll(/\{\{\s*[\w.]+\s*\}\}/g)].map((m) => m[0].replace(/\s+/g, "")).sort();
const setEq = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const tpls = await db.select().from(documentTemplatesTable);
const byKey = new Map(tpls.map((t) => [t.key, t]));

let wrote = 0, warned = 0, missing = 0;
const touched = new Set<number>();

for (const [key, locs] of Object.entries(data)) {
  const tpl = byKey.get(key);
  if (!tpl) { console.error(`✗ no template for key="${key}"`); missing++; continue; }

  const [en] = await db.select().from(documentTemplateTranslationsTable)
    .where(and(eq(documentTemplateTranslationsTable.template_id, tpl.id), eq(documentTemplateTranslationsTable.locale, "en")));
  const enSubjPh = placeholders(en?.subject);
  const enBodyPh = placeholders(en?.body_html);

  for (const locale of LOCALES) {
    const tr = locs[locale];
    if (!tr) { console.error(`✗ ${key} [${locale}] missing in JSON`); missing++; continue; }

    // Placeholder parity check vs en.
    if (!setEq(placeholders(tr.subject), enSubjPh)) {
      console.warn(`⚠ ${key} [${locale}] subject placeholders differ: en=${enSubjPh} tr=${placeholders(tr.subject)}`);
      warned++;
    }
    if (!setEq(placeholders(tr.body_html), enBodyPh)) {
      console.warn(`⚠ ${key} [${locale}] body placeholders differ: en=${enBodyPh} tr=${placeholders(tr.body_html)}`);
      warned++;
    }

    if (DRY) { wrote++; continue; }

    const [existing] = await db.select().from(documentTemplateTranslationsTable)
      .where(and(eq(documentTemplateTranslationsTable.template_id, tpl.id), eq(documentTemplateTranslationsTable.locale, locale)));
    const values = { subject: tr.subject ?? null, body_html: tr.body_html ?? null, body_json: null, body_text: null };
    if (existing) {
      await db.update(documentTemplateTranslationsTable).set({ ...values, updated_at: new Date() })
        .where(eq(documentTemplateTranslationsTable.id, existing.id));
    } else {
      await db.insert(documentTemplateTranslationsTable).values({ template_id: tpl.id, locale, ...values });
    }
    touched.add(tpl.id);
    wrote++;
  }
}

// Re-publish every touched template (status, no version bump needed).
if (!DRY) {
  for (const id of touched) {
    await db.update(documentTemplatesTable).set({ status: "published", updated_at: new Date() })
      .where(eq(documentTemplatesTable.id, id));
  }
}

console.log(`\n${DRY ? "[DRY] " : ""}wrote=${wrote}  templates_published=${touched.size}  placeholderWarnings=${warned}  missing=${missing}`);
await pool.end();
