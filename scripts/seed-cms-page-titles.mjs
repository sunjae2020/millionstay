#!/usr/bin/env node
// Name each CMS page in the language the admin is read in.
//
// The pages were seeded with English labels, so a Korean tenant's content tree
// listed "Buy" and "For Owners". The site's own navigation already carries these
// names in six languages, so the titles come from there rather than from a new
// list somebody has to keep in step.
//
// Per-locale titles go on cms_page_translations; cms_pages.title (the fallback
// shown when a page has no version in the reader's language) takes the site's
// default locale.
//
// Usage:
//   DATABASE_URL=<tenant> node scripts/seed-cms-page-titles.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { guardDbInstance } from "./lib/dbGuard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APPLY = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}
guardDbInstance({ databaseUrl: url });

/**
 * Where each page's name comes from in the site's own locale files. `nav` keys
 * are the menu labels; the rest are page headings that have no menu entry.
 */
const NAME_SOURCE = {
  "": ["nav", "home"],
  about: ["nav", "about"],
  buy: ["nav", "buy"],
  rent: ["nav", "rent"],
  manage: ["nav", "management"],
  directions: ["nav", "directions"],
  stayplan: ["stayplan", "hero_title"],
  resident: ["resident", "hero_title"],
  owner: ["owner", "hero_title"],
  partner: ["partner", "hero_title"],
  privacy: ["privacy", "title"],
  terms: ["terms", "title"],
};

/** Headings are sentences; a tree entry needs a label. */
const SHORT_NAME = {
  ko: { stayplan: "체류 플랜", resident: "입주자 안내", owner: "소유주 안내", partner: "파트너 안내" },
  en: { stayplan: "Stay Plan", resident: "For Residents", owner: "For Owners", partner: "For Partners" },
  ja: { stayplan: "滞在プラン", resident: "入居者ガイド", owner: "オーナーガイド", partner: "パートナーガイド" },
  zh: { stayplan: "居住方案", resident: "住户指南", owner: "业主指南", partner: "合作伙伴指南" },
  th: { stayplan: "แผนการเข้าพัก", resident: "สำหรับผู้พักอาศัย", owner: "สำหรับเจ้าของ", partner: "สำหรับพันธมิตร" },
  vi: { stayplan: "Gói lưu trú", resident: "Dành cho cư dân", owner: "Dành cho chủ sở hữu", partner: "Dành cho đối tác" },
};

function localeStrings(locale) {
  const file = path.join(ROOT, `artifacts/million-stay-web/src/locales/${locale}/translation.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")).dev ?? {};
}

function nameFor(locale, slug) {
  const short = SHORT_NAME[locale]?.[slug];
  if (short) return short;
  const source = NAME_SOURCE[slug];
  if (!source) return null;
  const dev = localeStrings(locale);
  const value = dev?.[source[0]]?.[source[1]];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("supabase.") ? { rejectUnauthorized: false } : undefined,
});
const client = await pool.connect();

try {
  const { rows: sites } = await client.query(
    `SELECT site_key, default_locale, locales FROM cms_sites WHERE site_key = 'dev'`,
  );
  const site = sites[0];
  if (!site) {
    console.error("no dev site");
    process.exit(1);
  }
  const locales = Array.isArray(site.locales) ? site.locales : ["ko"];

  const { rows: pages } = await client.query(
    `SELECT id, slug FROM cms_pages WHERE site_key = 'dev' AND deleted_at IS NULL ORDER BY sort_order`,
  );

  const plan = [];
  for (const page of pages) {
    const names = {};
    for (const locale of locales) {
      const name = nameFor(locale, page.slug);
      if (name) names[locale] = name;
    }
    const fallback = names[site.default_locale] ?? Object.values(names)[0] ?? null;
    if (!fallback) continue;
    plan.push({ page, names, fallback });
    console.log(`  /${(page.slug || "(home)").padEnd(12)} ${fallback}`);
  }

  console.log(`\n${plan.length} pages, locales: ${locales.join(", ")}`);
  if (!APPLY) {
    console.log("\ndry run — pass --apply to write");
    process.exit(0);
  }

  for (const { page, names, fallback } of plan) {
    await client.query(`UPDATE cms_pages SET title = $2, updated_at = now() WHERE id = $1`, [
      page.id,
      fallback,
    ]);
    for (const [locale, name] of Object.entries(names)) {
      await client.query(
        `UPDATE cms_page_translations SET title = $3, updated_at = now()
          WHERE page_id = $1 AND locale = $2`,
        [page.id, locale, name],
      );
    }
  }
  console.log(`\napplied — ${plan.length} pages`);
} catch (err) {
  console.error("failed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
