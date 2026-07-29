/**
 * seed-hk-lease-agreement.mjs
 *
 * Seeds the ONE standard Korean lease agreement used for every unit type —
 * 시행사 (주)HK 임대차 계약서 — as an editable template (kind="pdf",
 * key="pdf.lease_agreement") under Templates Studio → PDF.
 *
 * Design (see routes/contracts.ts → buildContractDocInput):
 *   • ONE template, not one per type. The per-type detail (타입명, 전용/주거공용/
 *     공급/기타공용/계약면적, 대지지분, 호수, 층, 소재지) is pulled at render time
 *     from the contract's `spaces` row — falling back unit → parent type space,
 *     which is where Metheim authors the area breakdown. So A / A-1 / B / C /
 *     D / D-1 / E / E-1 all render from this single body.
 *   • ONE file. The clause text and the 별지 (특약사항) live in the same body,
 *     separated by a line containing exactly `[별지]`. The contract PDF renders
 *     everything before it as the agreement clauses and everything after it as a
 *     final page-broken annex section — one PDF, never two downloads.
 *
 * Body format: PLAIN TEXT, paragraphs separated by a blank line (the renderer
 * escapes HTML and preserves line breaks). `{{variables}}` are substituted from
 * the contract + its space — see VARS below for the full list.
 *
 * Source text lives beside this script as data/hk-lease-agreement.<locale>.txt
 * so the legal wording is reviewed as a plain file rather than inline in code.
 *
 * Usage:  DATABASE_URL=... node scripts/seed-hk-lease-agreement.mjs
 *         DATABASE_URL=... PUBLISH=1 node scripts/seed-hk-lease-agreement.mjs
 *
 * Seeds as `draft` by default — the agreement only starts appearing on generated
 * contracts once it is published (in the Studio, or with PUBLISH=1).
 */
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dir, "data");

const KEY = "pdf.lease_agreement";
const NAME = "임대차 계약서 — 표준 (시행사 (주)HK)";
const CATEGORY = "Documents";

/** Locales to seed, when a matching source file exists. `ko` is the source of truth. */
const LOCALES = ["ko", "en", "ja", "zh", "th", "vi"];

/**
 * Variables the body may reference. Mirrors contractTemplateVars() in
 * routes/contracts.ts — keep the two in sync when adding a placeholder.
 */
const VARS = {
  contract_ref: { type: "string" },
  contract_category: { type: "string" },
  tenant_name: { type: "string" },
  landlord_name: { type: "string" },
  start_date: { type: "date" },
  end_date: { type: "date" },
  // 부동산의 표시 — resolved from the contract's space (unit → parent type).
  location: { type: "string" },
  building: { type: "string" },
  unit_no: { type: "string" },
  floor: { type: "string" },
  unit_type: { type: "string" },
  structure_use: { type: "string" },
  area_exclusive: { type: "number" },
  area_residential_common: { type: "number" },
  area_supply: { type: "number" },
  area_other_common: { type: "number" },
  area_contract: { type: "number" },
  area_land_share: { type: "number" },
  // 금액 조건
  deposit_amount: { type: "number" },
  /** 차임 as written on the agreement — the rate-card list price. */
  monthly_rent: { type: "number" },
  /** 특판가 — the discounted rent the tenant actually pays each month. */
  promo_monthly_rent: { type: "number" },
  rent_due_day: { type: "number" },
  down_payment: { type: "number" },
  down_payment_date: { type: "date" },
  balance_amount: { type: "number" },
  balance_date: { type: "date" },
  total_rent: { type: "number" },
  currency: { type: "string" },
};

const bodies = {};
for (const loc of LOCALES) {
  const path = join(DATA, `hk-lease-agreement.${loc}.txt`);
  if (existsSync(path)) bodies[loc] = readFileSync(path, "utf8").trim();
}
if (!bodies.ko) {
  console.error(
    `✗ Missing ${join(DATA, "hk-lease-agreement.ko.txt")}\n` +
      "  Put the (주)HK 임대차 계약서 clause text there, with the 별지 (특약사항)\n" +
      "  in the same file after a line containing exactly: [별지]",
  );
  process.exit(1);
}
if (!bodies.ko.includes("[별지]")) {
  console.warn("⚠ No [별지] marker in the ko body — the annex page will not be rendered separately.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
const status = process.env.PUBLISH === "1" ? "published" : "draft";
try {
  const up = await c.query(
    `INSERT INTO document_templates (kind, key, name, category, variables_schema, status, version)
     VALUES ('pdf',$1,$2,$3,$4::jsonb,$5,1)
     ON CONFLICT (kind, key) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
       variables_schema=EXCLUDED.variables_schema, status=EXCLUDED.status, updated_at=now()
     RETURNING id`,
    [KEY, NAME, CATEGORY, JSON.stringify(VARS), status],
  );
  const id = up.rows[0].id;
  for (const [loc, body] of Object.entries(bodies)) {
    await c.query(
      `INSERT INTO document_template_translations (template_id, locale, subject, body_html)
       VALUES ($1,$2,NULL,$3)
       ON CONFLICT (template_id, locale) DO UPDATE SET body_html=EXCLUDED.body_html, updated_at=now()`,
      [id, loc, body],
    );
  }
  console.log(`✓ pdf/${KEY} (#${id}) — ${Object.keys(bodies).length} locales, status=${status}`);
} finally {
  c.release();
  await pool.end();
}
