/**
 * migrate-legacy-email-templates.mjs
 *
 * One-time, idempotent consolidation: copies the legacy `email_template` rows
 * into the unified `document_templates` (kind='email', key=template_code) so all
 * editable email/contract copy lives in one place (the Templates Studio). The
 * legacy table is left intact (dormant) — its admin UI is unlinked separately.
 *
 * Usage:  DATABASE_URL=... node scripts/migrate-legacy-email-templates.mjs --instance=<name> --apply
 *         (기본은 dry-run — --apply 없이는 아무것도 쓰지 않는다)
 */
import pg from "pg";
import { guardDbInstance, confirmWrite } from "../../../scripts/lib/dbGuard.mjs";
const { Pool } = pg;

const humanize = (code) =>
  code.toLowerCase().split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

guardDbInstance();
if (!confirmWrite()) process.exit(0);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  const legacy = (await c.query(`select template_code, subject, body_html, body_text, available_vars from email_template where deleted_at is null order by template_code`)).rows;
  let migrated = 0;
  for (const row of legacy) {
    const vars = Array.isArray(row.available_vars) ? row.available_vars : [];
    const schema = {};
    for (const v of vars) schema[v] = { type: "string" };
    const up = await c.query(
      `INSERT INTO document_templates (kind, key, name, category, variables_schema, status, version)
       VALUES ('email', $1, $2, 'System', $3::jsonb, 'published', 1)
       ON CONFLICT (kind, key) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
         variables_schema=EXCLUDED.variables_schema, status='published', updated_at=now()
       RETURNING id`,
      [row.template_code, humanize(row.template_code), JSON.stringify(schema)],
    );
    const id = up.rows[0].id;
    await c.query(
      `INSERT INTO document_template_translations (template_id, locale, subject, body_html, body_text)
       VALUES ($1, 'en', $2, $3, $4)
       ON CONFLICT (template_id, locale) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, updated_at=now()`,
      [id, row.subject ?? null, row.body_html ?? null, row.body_text ?? null],
    );
    console.log(`✓ ${row.template_code} → document_templates #${id}`);
    migrated++;
  }
  console.log(`Migrated ${migrated} legacy email templates.`);
} finally {
  c.release();
  await pool.end();
}
