// Run with: pnpm --filter @workspace/api-server test
//
// These cover the pure half of the SEO / GEO feature — the scorer and the
// builders. They live outside `src` on purpose: the api-server tsconfig only
// includes `src`, so importing a `.ts` path here does not need the compiler
// flag that would otherwise have to be turned on for the whole package.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  auditSeoGeo,
  computeDrift,
  countWords,
  extractBodySignals,
  type SeoSiteContext,
  type SeoSubject,
} from "../src/lib/seo/scoring.ts";
import { publicPathForPage } from "../src/lib/seo/publicRoutes.ts";
import {
  AI_CRAWLERS,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSeoHead,
  buildSitemapXml,
  isCrawlerUserAgent,
} from "../src/lib/seo/builders.ts";

const NOW = new Date("2026-09-08T00:00:00Z");

function emptySubject(overrides: Partial<SeoSubject> = {}): SeoSubject {
  return {
    entityType: "page",
    entityId: 1,
    locale: "ko",
    slug: "about",
    title: null,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    seoImageUrl: null,
    ogTitle: null,
    ogDescription: null,
    canonicalUrl: null,
    robotsDirectives: null,
    jsonLd: null,
    geoAnswerSummary: null,
    geoFaq: [],
    status: "Draft",
    updatedAt: null,
    localeCount: 0,
    bodyJson: null,
    legacyHtml: null,
    ...overrides,
  };
}

const BARE_SITE: SeoSiteContext = {
  brandName: "Metheim",
  hasOrganizationSchema: false,
  robotsHasAiRules: false,
  servesLlmsTxt: false,
};

const FULL_SITE: SeoSiteContext = {
  brandName: "Metheim",
  hasOrganizationSchema: true,
  robotsHasAiRules: true,
  servesLlmsTxt: true,
};

// ── Scoring ────────────────────────────────────────────────────────────────

test("an empty draft on a bare site scores almost nothing", () => {
  const result = auditSeoGeo(emptySubject(), BARE_SITE, NOW);
  // Only the two things that are true by default: the baseline schema node the
  // renderer always emits, and the absence of a noindex directive.
  assert.equal(result.scoreTotal, 9);
  assert.ok(result.gaps.length >= 12);
  assert.equal(result.gaps[0]?.severity, "high");
});

test("a fully filled page on a fully configured site scores 100", () => {
  const summary = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
  const subject = emptySubject({
    title: "Metheim Yeosu",
    seoTitle: "Metheim Yeosu — 여수 원도심 269세대 도시형 주거 안내입니다",
    seoDescription: "가".repeat(140),
    seoImageUrl: "https://example.test/og.jpg",
    ogTitle: "Metheim Yeosu",
    ogDescription: "설명",
    canonicalUrl: "https://example.test/about",
    jsonLd: { "@type": "WebPage" },
    geoAnswerSummary: summary,
    geoFaq: [
      { q: "q1", a: "a1" },
      { q: "q2", a: "a2" },
      { q: "q3", a: "a3" },
    ],
    status: "Published",
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    localeCount: 6,
    bodyJson: {
      blocks: [
        {
          id: "b1",
          type: "rich-text",
          props: {
            title: "건물 소개",
            body: Array.from({ length: 700 }, (_, i) => `단어${i}`).join(" "),
            items: [{ label: "a" }, { label: "b" }],
          },
        },
      ],
    },
  });
  const result = auditSeoGeo(subject, FULL_SITE, NOW);
  assert.equal(result.scoreTotal, 100);
  assert.equal(result.gaps.length, 0);
});

test("category maxima add up to 100", () => {
  const result = auditSeoGeo(emptySubject(), BARE_SITE, NOW);
  const total = Object.values(result.scores).reduce((sum, entry) => sum + entry.max, 0);
  assert.equal(total, 100);
});

test("GEO is the heaviest category", () => {
  const result = auditSeoGeo(emptySubject(), BARE_SITE, NOW);
  const maxima = Object.values(result.scores).map((entry) => entry.max);
  assert.equal(result.scores.geo.max, Math.max(...maxima));
});

test("noindex costs the indexable points and raises a high gap", () => {
  const withDirective = auditSeoGeo(
    emptySubject({ robotsDirectives: "noindex,follow" }),
    BARE_SITE,
    NOW,
  );
  const without = auditSeoGeo(emptySubject(), BARE_SITE, NOW);
  assert.equal(without.scoreTotal - withDirective.scoreTotal, 5);
  assert.ok(withDirective.gaps.some((gap) => gap.code === "not_indexable"));
});

test("two FAQ pairs score less than three", () => {
  const two = auditSeoGeo(
    emptySubject({ geoFaq: [{ q: "a", a: "b" }, { q: "c", a: "d" }] }),
    BARE_SITE,
    NOW,
  );
  const three = auditSeoGeo(
    emptySubject({ geoFaq: [{ q: "a", a: "b" }, { q: "c", a: "d" }, { q: "e", a: "f" }] }),
    BARE_SITE,
    NOW,
  );
  assert.equal(three.scoreTotal - two.scoreTotal, 4);
  assert.ok(two.gaps.some((gap) => gap.code === "faq_thin"));
});

test("a page edited long ago loses the freshness point", () => {
  const fresh = auditSeoGeo(emptySubject({ updatedAt: "2026-08-20T00:00:00Z" }), BARE_SITE, NOW);
  const stale = auditSeoGeo(emptySubject({ updatedAt: "2025-01-01T00:00:00Z" }), BARE_SITE, NOW);
  assert.equal(fresh.scoreTotal - stale.scoreTotal, 3);
  assert.ok(stale.gaps.some((gap) => gap.code === "stale"));
});

test("scoring is deterministic", () => {
  const subject = emptySubject({ title: "A", status: "Published" });
  const a = auditSeoGeo(subject, FULL_SITE, NOW);
  const b = auditSeoGeo(subject, FULL_SITE, NOW);
  assert.deepEqual(a, b);
});

// ── Word counting ──────────────────────────────────────────────────────────

test("word count handles spaced and unspaced scripts", () => {
  assert.equal(countWords("one two three"), 3);
  assert.equal(countWords("여수 원도심 주거"), 3);
  // Chinese has no spaces, so its characters are counted and halved: the four
  // Han characters count as two, plus the one Hangul word.
  assert.equal(countWords("여수租赁管理"), 1 + 2);
  assert.equal(countWords(null), 0);
});

// ── Body signals ───────────────────────────────────────────────────────────

test("body signals walk the block tree", () => {
  const signals = extractBodySignals({
    blocks: [
      {
        id: "1",
        type: "section",
        props: { title: "제목" },
        children: [
          { id: "2", type: "feature-list", props: { items: [{ title: "가", description: "나" }] } },
        ],
      },
      { id: "3", type: "hidden-one", hidden: true, props: { title: "보이지 않음" } },
    ],
  });
  // Only BLOCKS with a title count as headings — a title inside a repeated
  // item is list content, and it is counted on the list side instead.
  assert.equal(signals.headings, 1);
  assert.equal(signals.lists, 1);
  assert.ok(signals.text.includes("제목"));
  assert.ok(!signals.text.includes("보이지 않음"));
});

test("URLs, links and colours are not counted as prose", () => {
  const signals = extractBodySignals({
    blocks: [
      {
        id: "1",
        type: "hero",
        props: {
          title: "제목",
          image: { url: "https://cdn.example.test/a-very-long-image-name.jpg" },
          buttonUrl: "/buy",
          bg: "#ff8800",
          description: "실제 문장 하나",
        },
      },
    ],
  });
  assert.ok(signals.text.includes("실제 문장 하나"));
  assert.ok(!signals.text.includes("cdn.example.test"));
  assert.ok(!signals.text.includes("/buy"));
  assert.ok(!signals.text.includes("#ff8800"));
});

test("body signals read legacy HTML too", () => {
  const signals = extractBodySignals(null, "<h1>Title</h1><ul><li>One</li></ul><p>Body text</p>");
  assert.equal(signals.headings, 1);
  assert.equal(signals.lists, 1);
  assert.ok(signals.text.includes("Body text"));
  assert.ok(!signals.text.includes("<"));
});

// ── Drift ──────────────────────────────────────────────────────────────────

test("drift against no previous version is empty", () => {
  const drift = computeDrift(null, { scoreTotal: 42, gaps: [] });
  assert.deepEqual(drift, { scoreDelta: 0, added: [], resolved: [] });
});

test("drift reports what was fixed and what appeared", () => {
  const gap = (code: string) =>
    ({ code, label: code, severity: "high", category: "meta" }) as const;
  const drift = computeDrift(
    { scoreTotal: 40, gaps: [gap("a"), gap("b")] },
    { scoreTotal: 55, gaps: [gap("b"), gap("c")] },
  );
  assert.equal(drift.scoreDelta, 15);
  assert.deepEqual(drift.added.map((g) => g.code), ["c"]);
  assert.deepEqual(drift.resolved.map((g) => g.code), ["a"]);
});

// ── Public routes ──────────────────────────────────────────────────────────

test("a page slug maps to the address the site actually serves", () => {
  // These five differ on the Metheim site; publishing the slug would put
  // addresses in sitemap.xml that render the not-found screen.
  assert.equal(publicPathForPage("dev", "manage"), "/management");
  assert.equal(publicPathForPage("dev", "stayplan"), "/stay-plan");
  assert.equal(publicPathForPage("dev", "resident"), "/for-resident");
  assert.equal(publicPathForPage("dev", "owner"), "/for-owner");
  assert.equal(publicPathForPage("dev", "partner"), "/for-partner");
  assert.equal(publicPathForPage("dev", "privacy"), "/privacy-policy");
});

test("an unmapped slug is its own address, and home is the root", () => {
  assert.equal(publicPathForPage("dev", "about"), "/about");
  assert.equal(publicPathForPage("www", "about"), "/about");
  assert.equal(publicPathForPage("dev", ""), "/");
  assert.equal(publicPathForPage("dev", "home"), "/");
  assert.equal(publicPathForPage("www", "manage"), "/manage");
});

// ── Builders ───────────────────────────────────────────────────────────────

test("an authored title is used verbatim, a plain one gets the brand", () => {
  const base = {
    origin: "https://example.test/",
    path: "/about",
    brandName: "Metheim",
    siteLabel: "Metheim",
    organizationSchema: null,
    alternateLocales: ["ko", "en"],
  };
  const authored = buildSeoHead({ ...base, subject: emptySubject({ seoTitle: "직접 쓴 제목" }) });
  assert.equal(authored.title, "직접 쓴 제목");
  const plain = buildSeoHead({ ...base, subject: emptySubject({ title: "소개" }) });
  assert.equal(plain.title, "소개 — Metheim");
});

test("head falls back to a built canonical and default robots", () => {
  const head = buildSeoHead({
    subject: emptySubject({ title: "소개" }),
    origin: "https://example.test/",
    path: "/about",
    brandName: "Metheim",
    siteLabel: "Metheim",
    organizationSchema: null,
    alternateLocales: [],
  });
  assert.equal(head.canonical, "https://example.test/about");
  assert.equal(head.robots, "index,follow");
});

test("an explicit json_ld override replaces the generated node", () => {
  const head = buildSeoHead({
    subject: emptySubject({ jsonLd: { "@type": "Residence", name: "직접" } }),
    origin: "https://example.test",
    path: "/",
    brandName: "Metheim",
    siteLabel: "Metheim",
    organizationSchema: null,
    alternateLocales: [],
  });
  assert.equal(head.jsonLd.length, 1);
  assert.equal(head.jsonLd[0]?.["@type"], "Residence");
});

test("FAQ pairs and an organization add their own schema nodes", () => {
  const head = buildSeoHead({
    subject: emptySubject({ geoFaq: [{ q: "질문", a: "답" }] }),
    origin: "https://example.test",
    path: "/",
    brandName: "Metheim",
    siteLabel: "Metheim",
    organizationSchema: { name: "Metheim" },
    alternateLocales: [],
  });
  const types = head.jsonLd.map((node) => node["@type"]);
  assert.deepEqual(types, ["WebPage", "FAQPage", "Organization"]);
});

test("robots.txt names every AI crawler and points at the sitemap", () => {
  const txt = buildRobotsTxt("https://example.test/");
  for (const bot of AI_CRAWLERS) assert.ok(txt.includes(`User-agent: ${bot}`), bot);
  assert.ok(txt.includes("User-agent: *"));
  assert.ok(txt.includes("Sitemap: https://example.test/sitemap.xml"));
});

test("robots.txt appends the site's own extra rules", () => {
  const txt = buildRobotsTxt("https://example.test", "Disallow: /admin");
  assert.ok(txt.includes("Disallow: /admin"));
});

test("llms.txt skips empty sections", () => {
  const txt = buildLlmsTxt("Metheim", "여수 원도심 269세대", [
    { heading: "Pages", entries: [{ title: "소개", url: "https://example.test/about" }] },
    { heading: "Articles", entries: [] },
  ]);
  assert.ok(txt.startsWith("# Metheim"));
  assert.ok(txt.includes("> 여수 원도심 269세대"));
  assert.ok(txt.includes("## Pages"));
  assert.ok(!txt.includes("## Articles"));
});

test("sitemap escapes and carries alternates", () => {
  const xml = buildSitemapXml("https://example.test", [
    { path: "/", updatedAt: "2026-09-01T00:00:00Z", locales: ["ko", "en"] },
    { path: "/a&b" },
  ]);
  assert.ok(xml.includes("<loc>https://example.test/</loc>"));
  assert.ok(xml.includes("<lastmod>2026-09-01</lastmod>"));
  assert.ok(xml.includes('hreflang="ko"'));
  assert.ok(xml.includes("/a&amp;b"));
  assert.ok(!xml.includes("/a&b<"));
});

test("crawler user agents are recognised, browsers are not", () => {
  assert.ok(isCrawlerUserAgent("Mozilla/5.0 (compatible; GPTBot/1.2)"));
  assert.ok(isCrawlerUserAgent("ClaudeBot/1.0"));
  assert.ok(isCrawlerUserAgent("facebookexternalhit/1.1"));
  assert.ok(!isCrawlerUserAgent("Mozilla/5.0 (Macintosh) Safari/605"));
  assert.ok(!isCrawlerUserAgent(undefined));
});
