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
  console.error(`prerender-share-meta: no build at ${shellPath}`);
  process.exit(1);
}
const shell = fs.readFileSync(shellPath, "utf8");

/** Which CMS page key backs which public route. */
const ROUTES = {
  "": "dev-home",
  about: "dev-about",
  buy: "dev-buy",
  rent: "dev-rent",
  management: "dev-manage",
  stayplan: "dev-stayplan",
  "for-resident": "dev-resident",
  "for-owner": "dev-owner",
  "for-partner": "dev-partner",
  directions: "dev-directions",
  "privacy-policy": "dev-privacy",
  terms: "dev-terms",
  search: "dev-search",
};

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

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

let written = 0;
let skipped = 0;

for (const [route, pageKey] of Object.entries(ROUTES)) {
  const data = await getJson(`${API_URL}/api/v1/public/page-contents/${pageKey}/${LANG}`);
  const title = data?.seo_title?.trim();
  const description = data?.seo_description?.trim();
  if (!title && !description) {
    skipped += 1;
    continue;
  }

  const content = data?.content ?? {};
  const image = content.seo_image || content.hero_image_url || content.hero_1_image || "";

  let html = shell;
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = setMeta(html, "name", "twitter:image", image);

  // "" is the home route and its file is the shell itself.
  const outPath = route === "" ? shellPath : path.join(DIST, route, "index.html");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  written += 1;
  console.log(`  /${route.padEnd(14)} ${title ?? "(description only)"}`);
}

console.log(`prerender-share-meta: ${written} routes written, ${skipped} without SEO (left on the shared card)`);
