/**
 * One-off seed: fill homestay page_contents (content + SEO) and seed the www
 * guest-site translation keys into the translations table so the Page
 * Translations "Guest Site" tab is editable. Values are taken from the CURRENT
 * live content (production translations overlay ∪ static i18n JSON), so nothing
 * visibly changes — the CMS just stops being blank.
 *
 * Run (writes to the prod DB via api-server/.env DATABASE_URL):
 *   cd artifacts/api-server && node --env-file=.env --import tsx seed-cms.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db, pool, pageContentsTable, translationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES = resolve(__dirname, "../million-stay-web/src/locales");
const PROD_API = "https://workspaceapi-server-production-ff8e.up.railway.app";

const HS_LANGS = ["en", "ja", "ko", "th", "zh"];
const WWW_LANGS = ["en", "ja", "ko", "th", "vi", "zh"];

function loadStatic(lang: string): Record<string, any> {
  try {
    return JSON.parse(readFileSync(`${LOCALES}/${lang}/translation.json`, "utf8"));
  } catch {
    return {};
  }
}

function get(obj: any, dotKey: string): any {
  return dotKey.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function flatten(obj: any, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

const staticByLang: Record<string, Record<string, any>> = {};
for (const l of new Set([...HS_LANGS, ...WWW_LANGS])) staticByLang[l] = loadStatic(l);

// Production translations overlay (DB-managed values that may differ from the
// static JSON, e.g. after AI review).
const overlayByLang: Record<string, Record<string, string>> = {};
async function loadOverlay(lang: string) {
  try {
    const res = await fetch(`${PROD_API}/api/v1/public/translations/${lang}`);
    if (res.ok) {
      const json = await res.json();
      overlayByLang[lang] = (json?.data ?? {}) as Record<string, string>;
      return;
    }
  } catch {}
  overlayByLang[lang] = {};
}

// Live value for an i18n key = DB overlay → static → English static.
function live(key: string, lang: string): string {
  return (
    overlayByLang[lang]?.[key] ??
    (get(staticByLang[lang], key) as string) ??
    overlayByLang["en"]?.[key] ??
    (get(staticByLang["en"], key) as string) ??
    ""
  );
}

function stripHtml(s: string): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
// Truncate on a word boundary so we never cut mid-word (CJK has few spaces, so
// it falls back to a hard cut, which reads fine there).
function truncate(s: string, n: number): string {
  const x = stripHtml(s);
  if (x.length <= n) return x;
  const cut = x.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…";
}
// SEO title: append the brand only when it fits cleanly; otherwise use the
// page title on its own rather than a mid-word "… | Million…".
function seoTitle(title: string): string {
  const t = stripHtml(title);
  const withBrand = `${t} | Million Homestay`;
  if (withBrand.length <= 70) return withBrand;
  if (t.length <= 70) return t;
  return truncate(t, 67);
}

// ── Homestay page_contents: page key → CMS fields (== i18n leaf under homestay.<slug>)
const HS_PAGES: Record<string, { i18nPrefix: string; fields: string[]; titleField: string; descField: string }> = {
  "homestay-home": {
    i18nPrefix: "homestay.home",
    fields: ["hero_title", "hero_lead", "hero_cta_find", "hero_cta_host", "why_heading", "how_heading", "how_body", "how_cta"],
    titleField: "hero_title", descField: "hero_lead",
  },
  "homestay-about": {
    i18nPrefix: "homestay.about",
    fields: ["hero_eyebrow", "hero_title", "hero_lead_p1", "hero_lead_p2", "bridging_heading", "bridging_body", "mission_heading", "mission_body", "vision_heading", "vision_body"],
    titleField: "hero_title", descField: "hero_lead_p1",
  },
  "homestay-students": { i18nPrefix: "homestay.students", fields: ["hero_eyebrow", "hero_title", "hero_lead"], titleField: "hero_title", descField: "hero_lead" },
  "homestay-hosts": { i18nPrefix: "homestay.hosts", fields: ["hero_eyebrow", "hero_title", "hero_lead"], titleField: "hero_title", descField: "hero_lead" },
  "homestay-partners": { i18nPrefix: "homestay.partners", fields: ["hero_eyebrow", "hero_title", "hero_lead"], titleField: "hero_title", descField: "hero_lead" },
  "homestay-contact": { i18nPrefix: "homestay.contact", fields: ["heading", "subheading", "location_value"], titleField: "heading", descField: "subheading" },
};

async function seedHomestayPageContents() {
  let n = 0;
  for (const lang of HS_LANGS) {
    for (const [pageKey, def] of Object.entries(HS_PAGES)) {
      const content: Record<string, string> = {};
      for (const f of def.fields) {
        const v = live(`${def.i18nPrefix}.${f}`, lang);
        if (v) content[f] = v;
      }
      if (Object.keys(content).length === 0) continue;
      const titleRaw = stripHtml(content[def.titleField] ?? "");
      const seo_title = titleRaw ? seoTitle(titleRaw) : "Million Homestay";
      const seo_description = truncate(content[def.descField] ?? titleRaw, 160);
      const seo_keywords = truncate([titleRaw, "Million Homestay", "homestay"].filter(Boolean).join(", "), 120);

      await db
        .insert(pageContentsTable)
        .values({ page_key: pageKey, language: lang, content, seo_title, seo_description, seo_keywords })
        .onConflictDoUpdate({
          target: [pageContentsTable.page_key, pageContentsTable.language],
          set: { content, seo_title, seo_description, seo_keywords, updated_at: new Date() },
        });
      n++;
    }
  }
  console.log(`✓ homestay page_contents: upserted ${n} page×lang rows`);
}

// ── www guest-site translation keys → translations table (insert missing only)
const WWW_PREFIXES = ["home", "about", "student", "agent", "faq", "contact_page", "stay_plan", "blog_post", "nav", "footer", "search"];

async function seedWwwTranslations() {
  let inserted = 0;
  for (const lang of WWW_LANGS) {
    const stat = staticByLang[lang] ?? {};
    const en = staticByLang["en"] ?? {};
    const rows: { lang: string; key: string; value: string; source: string; reviewed_at: Date }[] = [];
    for (const prefix of WWW_PREFIXES) {
      const subtree = stat[prefix] ?? en[prefix];
      if (!subtree) continue;
      const flat = flatten(subtree, prefix);
      const flatEn = flatten(en[prefix] ?? {}, prefix);
      for (const [key, val] of Object.entries(flat)) {
        const value = (val && val.trim()) ? val : (flatEn[key] ?? "");
        if (!value) continue;
        rows.push({ lang, key, value, source: "human", reviewed_at: new Date() });
      }
    }
    if (rows.length === 0) continue;
    // Insert only missing (lang,key) rows — never clobber existing values.
    const res = await db.insert(translationsTable).values(rows).onConflictDoNothing({
      target: [translationsTable.lang, translationsTable.key],
    });
    inserted += rows.length;
    console.log(`  ${lang}: ${rows.length} www keys ensured`);
  }
  console.log(`✓ www translations: ensured up to ${inserted} rows (existing kept)`);
}

async function main() {
  for (const l of new Set([...HS_LANGS, ...WWW_LANGS])) await loadOverlay(l);
  await seedHomestayPageContents();
  await seedWwwTranslations();
  await pool.end();
  console.log("done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
