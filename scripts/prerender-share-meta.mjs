#!/usr/bin/env node
// Give every public route its own share card in the raw HTML.
//
// The guest site is a client-rendered SPA: it sets the title and meta tags after
// the JavaScript runs. Google executes JavaScript and sees them, but messaging
// apps and social scrapers (KakaoTalk, Facebook, Naver, X) read the HTML as
// served and nothing else — so a shared link showed the site-wide card no matter
// which page was shared.
//
// This runs AFTER the build: for each route it writes dist/public/<route>/index.html,
// a copy of the SPA shell whose title / description / og: tags are that page's,
// taken from the CMS. The app still boots and takes over routing, so behaviour
// for real visitors is unchanged — only the pre-JavaScript document differs.
//
// It also bakes in the canonical link, the hreflang alternates and the JSON-LD
// that answer engines read. That has to happen here rather than at request time:
// Vercel checks the filesystem BEFORE it applies a rewrite, so a route with its
// own index.html can never be intercepted by the crawler rewrite. Baking is the
// better half of the deal anyway — it is static, and it reaches every crawler
// rather than only the user-agents someone remembered to list.
//
// Usage:
//   API_URL=https://…  SITE_KEY=dev  [LANG=ko] node scripts/prerender-share-meta.mjs [dist-dir]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API_URL = (process.env.API_URL ?? "").replace(/\/$/, "");
const SITE_KEY = process.env.SITE_KEY ?? "";
const LANG = process.env.LANG_CODE ?? process.env.SITE_LANG ?? "ko";
const DIST = path.resolve(
  process.argv[2] ?? path.join(ROOT, "artifacts/million-stay-web/dist/public"),
);

if (!API_URL || !SITE_KEY) {
  console.log("prerender-share-meta: API_URL and SITE_KEY not set — skipping");
  process.exit(0);
}

const shellPath = path.join(DIST, "index.html");
if (!fs.existsSync(shellPath)) {
  // Nothing to decorate. Never fail the build over a share card.
  console.log(`prerender-share-meta: no build at ${shellPath} — skipping`);
  process.exit(0);
}
const shell = fs.readFileSync(shellPath, "utf8");

/**
 * Fallback route map: which CMS page key backs which public route, per site.
 * The API is asked first (GET /seo/routes) so the slug-to-URL translation lives
 * in ONE place; this copy is what keeps a release working if that call fails.
 * A route missing from the map keeps the site-wide card rather than a wrong one.
 */
const ROUTES_BY_SITE = {
  dev: {
    "": "dev-home",
    about: "dev-about",
    buy: "dev-buy",
    rent: "dev-rent",
    management: "dev-manage",
    "stay-plan": "dev-stayplan",
    "for-resident": "dev-resident",
    "for-owner": "dev-owner",
    "for-partner": "dev-partner",
    directions: "dev-directions",
    "privacy-policy": "dev-privacy",
    terms: "dev-terms",
    search: "dev-search",
  },
  www: {
    "": "home",
    "for-student": "for-student",
    "for-agent": "for-agent",
    about: "about",
    faq: "faq",
    contact: "contact",
  },
  homestay: {
    "": "homestay-home",
    about: "homestay-about",
    students: "homestay-students",
    hosts: "homestay-hosts",
    partners: "homestay-partners",
    contact: "homestay-contact",
  },
};

const FALLBACK_ROUTES = ROUTES_BY_SITE[SITE_KEY];

const escapeAttr = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Replace a meta tag's content, or append the tag when the shell lacks it. */
function setMeta(html, selectorAttr, name, value) {
  if (!value) return html;
  const safe = escapeAttr(value);
  const pattern = new RegExp(`(<meta ${selectorAttr}="${name}" content=")[^"]*(")`);
  if (pattern.test(html)) return html.replace(pattern, `$1${safe}$2`);
  return html.replace("</head>", `    <meta ${selectorAttr}="${name}" content="${safe}" />\n  </head>`);
}

/** Drop tags in just before </head>, after clearing any previous run's copies. */
function setHeadExtras(html, { canonical, alternates, jsonLd }) {
  let out = html.replace(/\s*<link rel="canonical"[^>]*>/g, "");
  out = out.replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>/g, "");
  out = out.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");

  const tags = [];
  if (canonical) tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}" />`);
  for (const alternate of alternates ?? []) {
    tags.push(
      `<link rel="alternate" hreflang="${escapeAttr(alternate.locale)}" href="${escapeAttr(alternate.href)}" />`,
    );
  }
  for (const node of jsonLd ?? []) {
    // `</` is the only sequence that can break out of a script element.
    const json = JSON.stringify(node).replace(/<\//g, "<\\/");
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  if (tags.length === 0) return out;
  return out.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Ask the API which routes this site publishes. Its answer already applies the
// slug-to-URL map, so a page stored as `resident` is prerendered at
// /for-resident where the router actually serves it.
const live = await getJson(`${API_URL}/seo/routes?site=${encodeURIComponent(SITE_KEY)}`);
const ROUTES = live?.routes?.length
  ? Object.fromEntries(
      live.routes.map((entry) => [String(entry.path ?? "/").replace(/^\//, ""), entry.legacyPageKey ?? ""]),
    )
  : FALLBACK_ROUTES;
if (!ROUTES) {
  console.log(`prerender-share-meta: no route map for site "${SITE_KEY}" — skipping`);
  process.exit(0);
}
console.log(
  `prerender-share-meta: ${Object.keys(ROUTES).length} routes (${live?.routes?.length ? "from the API" : "from the fallback map"})`,
);

let written = 0;
let skipped = 0;

try {
for (const [route, pageKey] of Object.entries(ROUTES)) {
  // The SEO service resolves the CMS block page and builds the same head the
  // API serves crawlers, so a prerendered route and a live one cannot drift.
  // The legacy page-contents overlay stays as the fallback for anything the
  // service does not know about.
  const meta = await getJson(
    `${API_URL}/seo/meta?site=${encodeURIComponent(SITE_KEY)}&path=${encodeURIComponent(route === "" ? "/" : `/${route}`)}`,
  );
  const data = pageKey
    ? await getJson(`${API_URL}/api/v1/public/page-contents/${pageKey}/${LANG}`)
    : null;
  const title = meta?.title?.trim() || data?.seo_title?.trim();
  const description = meta?.description?.trim() || data?.seo_description?.trim();
  if (!title && !description) {
    skipped += 1;
    continue;
  }

  const content = data?.content ?? {};
  const image =
    meta?.og?.["og:image"] || content.seo_image || content.hero_image_url || content.hero_1_image || "";

  let html = shell;
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = setMeta(html, "name", "twitter:image", image);
  html = setMeta(html, "name", "keywords", meta?.keywords);
  if (meta) {
    html = setHeadExtras(html, {
      canonical: meta.canonical,
      alternates: meta.alternates,
      jsonLd: meta.jsonLd,
    });
  }

  // "" is the home route and its file is the shell itself.
  const outPath = route === "" ? shellPath : path.join(DIST, route, "index.html");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  written += 1;
  console.log(`  /${route.padEnd(14)} ${title ?? "(description only)"}`);
}

} catch (err) {
  // The site still works with the site-wide card; a broken card must never stop
  // a release.
  console.log(`prerender-share-meta: stopped early (${err instanceof Error ? err.message : err})`);
}

console.log(`prerender-share-meta: ${written} routes written, ${skipped} without SEO (left on the shared card)`);
