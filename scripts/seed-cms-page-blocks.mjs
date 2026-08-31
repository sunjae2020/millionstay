#!/usr/bin/env node
// Compose a block body for each development-site page from the copy the site
// already ships, and copy the page's SEO into the block CMS.
//
// Why this exists: the CMS has two stores. `page_contents` holds the overlay the
// built-in pages read (that is where the SEO went, and it IS live), while
// `cms_page_translations` holds the block bodies the page builder edits. The
// builder was empty because nothing had ever been written to the second one.
//
// The words here are NOT invented: every string is read from the site's own
// Korean locale file (dev.*), which is the copy currently on the page. Anything
// an editor has already overridden in `page_contents` wins over it.
//
// The unit-type tables are read from the database via the same fields
// seed-metheim-page-content.mjs wrote, so the figures stay single-sourced.
//
// Usage:
//   DATABASE_URL=<metheim> node scripts/seed-cms-page-blocks.mjs --instance=<name> [--apply] [--locale=ko]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { guardDbInstance } from "./lib/dbGuard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APPLY = process.argv.includes("--apply");
const LOCALE = (process.argv.find((a) => a.startsWith("--locale=")) ?? "--locale=ko").slice(9);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set (point it at the tenant database)");
  process.exit(1);
}
guardDbInstance({ databaseUrl: url });

const locale = JSON.parse(
  fs.readFileSync(path.join(ROOT, `artifacts/million-stay-web/src/locales/${LOCALE}/translation.json`), "utf8"),
);
const DEV = locale.dev ?? {};

let seq = 0;
const id = () => `seed_${(seq += 1)}`;

/** A block, with empty props stripped so the editor sees no blank fields. */
const block = (type, props, style) => {
  const clean = Object.fromEntries(
    Object.entries(props).filter(([, v]) => {
      if (v == null || v === "") return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return Object.values(v).some((x) => x !== "" && x != null);
      return true;
    }),
  );
  return { id: id(), type, props: clean, ...(style ? { style } : {}) };
};

/** Collect `<prefix>_1_<field>` … groups into rows, stopping at the first gap. */
function group(section, prefix, fields, max = 8) {
  const rows = [];
  for (let i = 1; i <= max; i += 1) {
    const row = {};
    let has = false;
    for (const [key, suffix] of Object.entries(fields)) {
      const value = section[`${prefix}_${i}_${suffix}`];
      if (value) {
        row[key] = value;
        has = true;
      }
    }
    if (!has) break;
    rows.push(row);
  }
  return rows;
}

const HERO = { bg: "ink", width: "full", spacingTop: 0, spacingBottom: 0, align: "center" };
const BAND = { spacingTop: 3, spacingBottom: 3, width: "contained" };
const CREAM = { bg: "surface", spacingTop: 3, spacingBottom: 3, width: "contained" };
const CTA = { bg: "primary", spacingTop: 3, spacingBottom: 3, align: "center", width: "full" };

/** Build the block body for one page from its own section of the locale file. */
function buildBlocks(pageKey, content) {
  const s = (section, key) => DEV[section]?.[key] ?? "";
  // An editor's CMS override wins over the shipped copy.
  const c = (key, fallback) => (content[key] && String(content[key]).trim()) || fallback;
  const out = [];

  switch (pageKey) {
    case "dev-home": {
      out.push(
        block("hero-banner", {
          title: c("hero_1_title", s("home", "hero_title")),
          subtitle: s("home", "hero_eyebrow"),
          description: c("hero_1_subtitle", s("home", "hero_subtitle")),
          buttonLabel: s("home", "hero_cta_buy"),
          buttonUrl: "/buy",
          secondaryLabel: s("home", "hero_cta_rent"),
          secondaryUrl: "/rent",
          backgroundImage: { url: c("hero_1_image", ""), alt: "" },
          overlay: true,
        }, HERO),
        block("services", {
          title: s("home", "why_heading"),
          items: [
            { title: s("home", "pillar_buy_title"), description: s("home", "pillar_buy_body"), href: "/buy" },
            { title: s("home", "pillar_rent_title"), description: s("home", "pillar_rent_body"), href: "/rent" },
            { title: s("home", "pillar_mgmt_title"), description: s("home", "pillar_mgmt_body"), href: "/management" },
          ],
        }, BAND),
        block("feature-list", {
          title: s("home", "why_heading"),
          columns: "3",
          items: group(DEV.home ?? {}, "why", { title: "title", description: "body" }, 6),
        }, CREAM),
        block("statistics", {
          title: s("home", "stats_heading"),
          items: group(DEV.home ?? {}, "stat", { value: "value", label: "label" }, 6),
        }, BAND),
        block("testimonials", {
          title: s("home", "reviews_heading"),
          subtitle: s("home", "reviews_subtitle"),
          items: group(DEV.home ?? {}, "review", { quote: "quote", author: "name", role: "role" }, 6),
        }, CREAM),
        block("cta-banner", {
          title: s("home", "cta_title"),
          subtitle: s("home", "cta_subtitle"),
          buttonLabel: s("home", "pillar_buy_cta"),
          buttonUrl: "/buy",
        }, CTA),
      );
      break;
    }

    case "dev-about": {
      out.push(
        block("hero-banner", {
          title: c("hero_title", s("about", "hero_title")),
          subtitle: s("about", "eyebrow"),
          description: c("hero_subtitle", s("about", "hero_subtitle")),
          backgroundImage: { url: c("hero_image_url", ""), alt: "" },
          overlay: true,
        }, HERO),
        block("rich-text", {
          title: s("about", "story_title"),
          body: [s("about", "story_p1"), s("about", "story_p2")]
            .filter(Boolean)
            .map((p) => `<p>${p}</p>`)
            .join(""),
        }, BAND),
        block("feature-list", {
          title: s("about", "values_title"),
          columns: "3",
          items: group(DEV.about ?? {}, "value", { title: "title", description: "body" }, 6),
        }, CREAM),
        block("rich-text", {
          title: s("about", "vision_title"),
          body: s("about", "vision_body") ? `<p>${s("about", "vision_body")}</p>` : "",
        }, BAND),
        block("statistics", {
          items: group(DEV.about ?? {}, "stat", { value: "value", label: "label" }, 6),
        }, CREAM),
      );
      break;
    }

    case "dev-buy": {
      const types = group(content, "type", {
        name: "name", kind: "kind", exclusive: "exclusive", supply: "supply",
        contract: "contract", units: "units",
      });
      out.push(
        block("hero-banner", {
          title: c("hero_title", s("buy", "hero_title")),
          subtitle: s("buy", "eyebrow"),
          description: c("hero_subtitle", s("buy", "hero_subtitle")),
          overlay: true,
        }, HERO),
        block("rich-text", {
          title: s("buy", "overview_title"),
          body: [s("buy", "overview_p1"), s("buy", "overview_p2")]
            .filter(Boolean)
            .map((p) => `<p>${p}</p>`)
            .join(""),
        }, BAND),
      );
      if (types.length > 0) {
        out.push(
          block("rich-text", {
            title: s("buy", "types_title") || "타입별 분양 정보",
            body:
              "<table><thead><tr><th>타입</th><th>구분</th><th>전용면적</th><th>공급면적</th><th>계약면적</th><th>세대수</th></tr></thead><tbody>" +
              types
                .map(
                  (r) =>
                    `<tr><td>${r.name ?? ""}</td><td>${r.kind ?? ""}</td><td>${r.exclusive ?? ""}</td>` +
                    `<td>${r.supply ?? ""}</td><td>${r.contract ?? ""}</td><td>${r.units ?? ""}</td></tr>`,
                )
                .join("") +
              "</tbody></table>",
          }, CREAM),
        );
      }
      out.push(
        block("sale-listings", { title: s("buy", "board_title"), limit: 6, emptyText: s("buy", "board_empty") }, BAND),
        block("cta-banner", {
          title: s("buy", "inquiry_title"),
          subtitle: s("buy", "inquiry_subtitle"),
          buttonLabel: s("buy", "inquiry_submit") || s("form", "submit"),
          buttonUrl: "/buy#inquiry",
        }, CTA),
      );
      break;
    }

    case "dev-rent": {
      const types = group(content, "type", {
        name: "name", kind: "kind", exclusive: "exclusive", supply: "supply",
        deposit: "deposit", rent: "rent",
      });
      out.push(
        block("hero-banner", {
          title: c("hero_title", s("rent", "hero_title")),
          subtitle: s("rent", "eyebrow"),
          description: c("hero_subtitle", s("rent", "hero_subtitle")),
          overlay: true,
        }, HERO),
        block("feature-list", {
          title: s("rent", "short_title"),
          columns: "2",
          items: [
            { title: s("rent", "short_heading"), description: s("rent", "short_body") },
            { title: s("rent", "long_title"), description: s("rent", "long_body") },
          ].filter((i) => i.title || i.description),
        }, BAND),
      );
      if (types.length > 0) {
        out.push(
          block("rich-text", {
            title: "타입별 임대 조건",
            body:
              "<table><thead><tr><th>타입</th><th>구분</th><th>전용면적</th><th>공급면적</th><th>보증금</th><th>월 임대료</th></tr></thead><tbody>" +
              types
                .map(
                  (r) =>
                    `<tr><td>${r.name ?? ""}</td><td>${r.kind ?? ""}</td><td>${r.exclusive ?? ""}</td>` +
                    `<td>${r.supply ?? ""}</td><td>${r.deposit ?? ""}</td><td>${r.rent ?? ""}</td></tr>`,
                )
                .join("") +
              "</tbody></table>",
          }, CREAM),
        );
      }
      out.push(
        block("space-listings", { title: s("rent", "vacancy_title"), limit: 6, emptyText: s("rent", "vacancy_empty") }, BAND),
        block("cta-banner", {
          title: s("rent", "inquiry_title"),
          subtitle: s("rent", "inquiry_subtitle"),
          buttonLabel: s("rent", "short_cta"),
          buttonUrl: "/rent#inquiry",
        }, CTA),
      );
      break;
    }

    case "dev-manage": {
      out.push(
        block("hero-banner", {
          title: c("hero_title", s("mgmt", "hero_title")),
          subtitle: s("mgmt", "eyebrow"),
          description: c("hero_subtitle", s("mgmt", "hero_subtitle")),
          overlay: true,
        }, HERO),
        block("feature-list", {
          title: s("mgmt", "benefits_heading"),
          columns: "3",
          items: group(DEV.mgmt ?? {}, "benefit", { title: "title", description: "body" }, 6),
        }, BAND),
        block("feature-list", {
          title: s("mgmt", "why_heading"),
          columns: "3",
          items: group(DEV.mgmt ?? {}, "why", { title: "title", description: "body" }, 6),
        }, CREAM),
        block("steps", {
          title: s("mgmt", "steps_heading"),
          items: group(DEV.mgmt ?? {}, "step", { title: "title", description: "body" }, 8),
        }, BAND),
        block("cta-banner", {
          title: s("mgmt", "apply_title"),
          subtitle: s("mgmt", "apply_subtitle"),
          buttonLabel: s("mgmt", "apply_submit") || s("form", "submit"),
          buttonUrl: "/management#apply",
        }, CTA),
      );
      break;
    }

    case "dev-directions": {
      out.push(
        block("hero-banner", {
          title: c("hero_title", s("directions", "hero_title")),
          subtitle: s("directions", "eyebrow"),
          description: c("hero_subtitle", s("directions", "hero_subtitle")),
          overlay: true,
        }, HERO),
        block("contact-block", {
          title: s("directions", "address_label"),
          address: s("directions", "address"),
          phone: s("directions", "phone"),
          email: s("directions", "email"),
          hours: s("directions", "hours"),
          useCompanyInfo: true,
        }, BAND),
        block("google-maps", { title: s("directions", "map_title"), address: s("directions", "address"), zoom: 16 }, CREAM),
        block("feature-list", {
          title: s("directions", "transit_title"),
          columns: "2",
          items: group(DEV.directions ?? {}, "transit", { title: "title", description: "body" }, 6),
        }, BAND),
      );
      break;
    }

    case "dev-stayplan": {
      const sec = DEV.stayplan ?? {};
      out.push(
        block("hero-banner", {
          title: c("hero_title", sec.hero_title), subtitle: sec.eyebrow,
          description: c("hero_subtitle", sec.hero_subtitle), overlay: true,
        }, HERO),
        block("pricing", {
          title: sec.plans_title ?? "",
          plans: ["nightly", "monthly", "lease"]
            .map((k) => ({
              name: sec[`plan_${k}_title`] ?? "",
              period: sec[`plan_${k}_term`] ?? "",
              description: sec[`plan_${k}_body`] ?? "",
              buttonLabel: sec[`plan_${k}_cta`] ?? "",
              buttonUrl: "/rent",
            }))
            .filter((p) => p.name),
        }, BAND),
        block("feature-list", {
          title: sec.included_title,
          columns: "4",
          items: group(sec, "included", { title: "title", description: "body" }, 8),
        }, CREAM),
        block("cta-banner", {
          title: sec.inquiry_title, subtitle: sec.inquiry_subtitle,
          buttonLabel: sec.inquiry_submit, buttonUrl: "/rent#inquiry",
        }, CTA),
      );
      break;
    }

    case "dev-resident": {
      const sec = DEV.resident ?? {};
      out.push(
        block("hero-banner", {
          title: c("hero_title", sec.hero_title), subtitle: sec.eyebrow,
          description: c("hero_subtitle", sec.hero_subtitle),
          buttonLabel: sec.cta_browse, buttonUrl: "/rent",
          secondaryLabel: sec.cta_inquiry, secondaryUrl: "/rent#inquiry", overlay: true,
        }, HERO),
        block("feature-list", {
          title: sec.why_title, columns: "4",
          items: group(sec, "why", { title: "title", description: "body" }, 8),
        }, BAND),
        block("steps", {
          title: sec.steps_title,
          items: group(sec, "step", { title: "title", description: "body" }, 8),
        }, CREAM),
        block("cta-banner", {
          title: sec.inquiry_title, subtitle: sec.inquiry_subtitle,
          buttonLabel: sec.inquiry_submit, buttonUrl: "/rent#inquiry",
        }, CTA),
      );
      break;
    }

    case "dev-owner": {
      const sec = DEV.owner ?? {};
      out.push(
        block("hero-banner", {
          title: c("hero_title", sec.hero_title), subtitle: sec.eyebrow,
          description: c("hero_subtitle", sec.hero_subtitle), overlay: true,
        }, HERO),
        block("about-us", {
          title: sec.benefits_title, description: sec.benefits_body ? `<p>${sec.benefits_body}</p>` : "",
          highlights: group(sec, "benefit", { title: "title", description: "body" }, 8),
        }, BAND),
        block("steps", {
          title: sec.how_title,
          items: group(sec, "how", { title: "title", description: "body" }, 8),
        }, CREAM),
        block("cta-banner", {
          title: sec.inquiry_title, subtitle: sec.inquiry_subtitle,
          buttonLabel: sec.inquiry_submit, buttonUrl: "/management#apply",
        }, CTA),
      );
      break;
    }

    case "dev-partner": {
      const sec = DEV.partner ?? {};
      out.push(
        block("hero-banner", {
          title: c("hero_title", sec.hero_title), subtitle: sec.eyebrow,
          description: c("hero_subtitle", sec.hero_subtitle), overlay: true,
        }, HERO),
        block("feature-list", {
          title: sec.why_title, columns: "3",
          items: group(sec, "why", { title: "title", description: "body" }, 6),
        }, BAND),
        block("cta-banner", {
          title: sec.inquiry_title, subtitle: sec.inquiry_subtitle,
          buttonLabel: sec.inquiry_submit, buttonUrl: "/for-partner#inquiry",
        }, CTA),
      );
      break;
    }

    case "dev-privacy":
    case "dev-terms": {
      // Legal pages are a numbered set of s1…s8 title/body sections.
      const sec = DEV[pageKey.replace("dev-", "")] ?? {};
      out.push(
        block("hero-banner", {
          title: c("title", sec.title), subtitle: sec.badge,
          description: sec.updated, overlay: true,
        }, HERO),
      );
      if (sec.intro) out.push(block("rich-text", { body: `<p>${sec.intro}</p>` }, BAND));
      const sections = [];
      for (let i = 1; i <= 12; i += 1) {
        const title = sec[`s${i}_title`];
        const body = sec[`s${i}_body`];
        if (!title && !body) continue;
        sections.push(`<h3>${title ?? ""}</h3><p>${body ?? ""}</p>`);
      }
      if (sections.length > 0) out.push(block("rich-text", { body: sections.join("") }, BAND));
      break;
    }

    default: {
      const sec = DEV[pageKey.replace("dev-", "")] ?? {};
      out.push(
        block("hero-banner", {
          title: c("hero_title", sec.hero_title ?? ""), subtitle: sec.eyebrow ?? "",
          description: c("hero_subtitle", sec.hero_subtitle ?? ""), overlay: true,
        }, HERO),
      );
      break;
    }
  }

  return out.filter((b) => Object.keys(b.props).length > 0);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("supabase.") ? { rejectUnauthorized: false } : undefined,
});
const client = await pool.connect();

try {
  const { rows: pages } = await client.query(
    `SELECT id, slug, legacy_page_key, title FROM cms_pages
      WHERE site_key = 'dev' AND deleted_at IS NULL ORDER BY sort_order`,
  );

  let totalBlocks = 0;
  const plan = [];
  for (const page of pages) {
    const key = page.legacy_page_key;
    if (!key) continue;
    const { rows: legacy } = await client.query(
      `SELECT content, seo_title, seo_description, seo_keywords
         FROM page_contents WHERE page_key = $1 AND language = $2`,
      [key, LOCALE],
    );
    const row = legacy[0] ?? {};
    const blocks = buildBlocks(key, row.content ?? {});
    totalBlocks += blocks.length;
    plan.push({ page, key, blocks, seo: row });
    console.log(`  ${String(page.id).padStart(3)} ${key.padEnd(16)} ${String(blocks.length).padStart(2)} blocks   ${row.seo_title ? "SEO ✓" : "SEO —"}`);
  }
  console.log(`\n${plan.length} pages, ${totalBlocks} blocks, locale ${LOCALE}`);

  if (!APPLY) {
    console.log("\ndry run — pass --apply to write");
    process.exit(0);
  }

  for (const { page, blocks, seo } of plan) {
    await client.query(
      `INSERT INTO cms_page_translations
         (page_id, locale, title, seo_title, seo_description, seo_keywords, body_json, status, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'Draft', 'human')
       ON CONFLICT (page_id, locale) DO UPDATE
          SET title = EXCLUDED.title,
              seo_title = EXCLUDED.seo_title,
              seo_description = EXCLUDED.seo_description,
              seo_keywords = EXCLUDED.seo_keywords,
              body_json = EXCLUDED.body_json,
              updated_at = now()`,
      [page.id, LOCALE, page.title, seo.seo_title ?? null, seo.seo_description ?? null,
       seo.seo_keywords ?? null, JSON.stringify({ blocks })],
    );
    // Page-level SEO too, so the list and the share image have a value.
    await client.query(
      `UPDATE cms_pages SET seo_title = $2, seo_description = $3, seo_keywords = $4, updated_at = now()
        WHERE id = $1`,
      [page.id, seo.seo_title ?? null, seo.seo_description ?? null, seo.seo_keywords ?? null],
    );
  }
  console.log(`\napplied — ${plan.length} pages`);
} catch (err) {
  console.error("failed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
