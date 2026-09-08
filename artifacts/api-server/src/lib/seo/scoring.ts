// ---------------------------------------------------------------------------
// SEO / GEO scoring — a PURE module. No database, no network, no clock reads
// beyond an injected `now`, so the same subject always scores the same and the
// whole thing is unit-testable (artifacts/api-server/tests/seo-scoring.test.ts).
//
// It scores the metadata we have STORED for a page, not a live crawl. That is
// deliberate: the question staff need answered is "is this page carrying what a
// search engine and an answer engine need", and that is knowable from our own
// content. GEO carries the heaviest weight because being *quoted* by an answer
// engine is the goal here, and answer engines quote self-contained prose.
// ---------------------------------------------------------------------------

export type SeoEntityType = "page" | "blog" | "listing";

export type SeoCategory =
  | "meta"
  | "schema"
  | "geo"
  | "content"
  | "signals"
  | "robots"
  | "llms"
  | "brand";

export type GapSeverity = "high" | "medium" | "low";

export interface SeoFaqPair {
  q: string;
  a: string;
}

/** One entity resolved at one locale — translation value ?? base value. */
export interface SeoSubject {
  entityType: SeoEntityType;
  entityId: number;
  locale: string;
  slug: string;
  /** The plain page name, used when no seo_title is authored. */
  title: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoImageUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  canonicalUrl: string | null;
  robotsDirectives: string | null;
  jsonLd: unknown;
  geoAnswerSummary: string | null;
  geoFaq: SeoFaqPair[];
  /** 'Published' means live; anything else is a draft. */
  status: string | null;
  updatedAt: Date | string | null;
  /** How many locales this entity has a translation row for. */
  localeCount: number;
  bodyJson: unknown;
  legacyHtml: string | null;
}

/** Site-wide facts that individual pages inherit. */
export interface SeoSiteContext {
  brandName: string;
  /** seo_defaults.organizationSchema is filled in. */
  hasOrganizationSchema: boolean;
  /** The instance serves a robots.txt that names the AI crawlers. */
  robotsHasAiRules: boolean;
  /** The instance serves a curated llms.txt. */
  servesLlmsTxt: boolean;
}

export interface SeoGap {
  code: string;
  /** English fallback; the admin renders `seo.gap_<code>` when translated. */
  label: string;
  severity: GapSeverity;
  category: SeoCategory;
}

export interface SeoCategoryScore {
  score: number;
  max: number;
}

export interface SeoAuditResult {
  scoreTotal: number;
  scores: Record<SeoCategory, SeoCategoryScore>;
  gaps: SeoGap[];
}

export interface BodySignals {
  text: string;
  words: number;
  headings: number;
  lists: number;
}

const CATEGORY_MAX: Record<SeoCategory, number> = {
  meta: 20,
  schema: 16,
  geo: 22,
  content: 14,
  signals: 8,
  robots: 8,
  llms: 6,
  brand: 6,
};

const SEVERITY_ORDER: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 };

// ── Text helpers ───────────────────────────────────────────────────────────

// Chinese and Japanese write without spaces, so splitting on whitespace would
// score a full CJK paragraph as one word. Count those scripts by character and
// halve it — roughly a word. Korean is written with spaces and needs no such
// treatment, so Hangul is deliberately absent from this range.
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g;

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const cjkChars = text.match(CJK)?.length ?? 0;
  const rest = text.replace(CJK, " ");
  const words = rest.split(/\s+/).filter(Boolean).length;
  return words + Math.ceil(cjkChars / 2);
}

/** Characters, counted by code point so emoji and CJK count as one each. */
export function countChars(text: string | null | undefined): number {
  if (!text) return 0;
  return [...text.trim()].length;
}

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Body signals ───────────────────────────────────────────────────────────

/** A URL, path, colour or bare token — present in props, but not prose. */
function isNotProse(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (/^(https?:)?\/\//i.test(text)) return true;
  if (/^(data|mailto|tel|blob):/i.test(text)) return true;
  if (/^\/[^\s]*$/.test(text)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return true;
  return false;
}

/**
 * Walk a block tree (or legacy HTML) and report how much substance the page
 * actually carries. Answer engines quote pages with real prose, headings and
 * lists; a page of three hero images has nothing to quote.
 */
export function extractBodySignals(bodyJson: unknown, legacyHtml?: string | null): BodySignals {
  const parts: string[] = [];
  let headings = 0;
  let lists = 0;

  const visitBlock = (block: unknown): void => {
    if (!block || typeof block !== "object") return;
    const node = block as Record<string, unknown>;
    if (node["hidden"] === true) return;

    const props = (node["props"] && typeof node["props"] === "object"
      ? (node["props"] as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    // A block that carries its own title reads as a section heading.
    if (isFilled(props["title"] as string) || isFilled(props["heading"] as string)) headings += 1;

    for (const value of Object.values(props)) collectValue(value);

    const children = node["children"];
    if (Array.isArray(children)) for (const child of children) visitBlock(child);
  };

  const collectValue = (value: unknown): void => {
    if (typeof value === "string") {
      // Image URLs, links and colour tokens are props too, and counting them as
      // prose would inflate the word count of a page that says almost nothing.
      if (isNotProse(value)) return;
      const text = value.includes("<") ? stripHtml(value) : value;
      if (text.trim()) parts.push(text.trim());
      return;
    }
    if (Array.isArray(value)) {
      // Repeated entries (items, cards, FAQ pairs, steps…) are the list signal.
      if (value.some((entry) => entry && typeof entry === "object")) lists += 1;
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          for (const inner of Object.values(entry as Record<string, unknown>)) collectValue(inner);
        } else {
          collectValue(entry);
        }
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const inner of Object.values(value as Record<string, unknown>)) collectValue(inner);
    }
  };

  const blocks = Array.isArray(bodyJson)
    ? bodyJson
    : bodyJson && typeof bodyJson === "object"
      ? ((bodyJson as Record<string, unknown>)["blocks"] as unknown)
      : null;
  if (Array.isArray(blocks)) for (const block of blocks) visitBlock(block);

  if (isFilled(legacyHtml)) {
    const html = legacyHtml as string;
    headings += html.match(/<h[1-3][\s>]/gi)?.length ?? 0;
    lists += html.match(/<(ul|ol)[\s>]/gi)?.length ?? 0;
    parts.push(stripHtml(html));
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return { text, words: countWords(text), headings, lists };
}

// ── Scoring ────────────────────────────────────────────────────────────────

function isIndexable(directives: string | null | undefined, status: string | null): boolean {
  const value = (directives ?? "").toLowerCase();
  if (value.includes("noindex") || value.includes("none")) return false;
  if ((status ?? "").toLowerCase() === "private") return false;
  return true;
}

function hasJsonLd(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

function validFaq(pairs: SeoFaqPair[] | null | undefined): SeoFaqPair[] {
  if (!Array.isArray(pairs)) return [];
  return pairs.filter((pair) => pair && isFilled(pair.q) && isFilled(pair.a));
}

function daysSince(value: Date | string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (now.getTime() - date.getTime()) / 86_400_000;
}

/**
 * Score one subject out of 100 across eight categories and list what is
 * missing. Pure: same inputs, same output.
 */
export function auditSeoGeo(
  subject: SeoSubject,
  site: SeoSiteContext,
  now: Date = new Date(),
): SeoAuditResult {
  const gaps: SeoGap[] = [];
  const add = (
    code: string,
    label: string,
    severity: GapSeverity,
    category: SeoCategory,
  ): void => {
    gaps.push({ code, label, severity, category });
  };

  const scores: Record<SeoCategory, SeoCategoryScore> = {
    meta: { score: 0, max: CATEGORY_MAX.meta },
    schema: { score: 0, max: CATEGORY_MAX.schema },
    geo: { score: 0, max: CATEGORY_MAX.geo },
    content: { score: 0, max: CATEGORY_MAX.content },
    signals: { score: 0, max: CATEGORY_MAX.signals },
    robots: { score: 0, max: CATEGORY_MAX.robots },
    llms: { score: 0, max: CATEGORY_MAX.llms },
    brand: { score: 0, max: CATEGORY_MAX.brand },
  };

  // ── meta (20) ────────────────────────────────────────────────────────────
  const effectiveTitle = isFilled(subject.seoTitle) ? subject.seoTitle! : (subject.title ?? "");
  if (isFilled(effectiveTitle)) {
    scores.meta.score += 4;
    const titleChars = countChars(effectiveTitle);
    if (titleChars >= 30 && titleChars <= 60) scores.meta.score += 2;
    else add("title_length", "Title is outside the 30–60 character sweet spot", "low", "meta");
  } else {
    add("title_missing", "No title", "high", "meta");
  }

  if (isFilled(subject.seoDescription)) {
    scores.meta.score += 5;
    const descChars = countChars(subject.seoDescription);
    if (descChars >= 120 && descChars <= 165) scores.meta.score += 2;
    else add("description_length", "Description is outside 120–165 characters", "medium", "meta");
  } else {
    add("description_missing", "No meta description", "high", "meta");
  }

  if (isFilled(subject.canonicalUrl)) scores.meta.score += 2;
  else add("canonical_missing", "No canonical URL", "medium", "meta");

  if (isFilled(subject.ogTitle) || isFilled(effectiveTitle)) scores.meta.score += 1;
  else add("og_title_missing", "No Open Graph title", "low", "meta");

  if (isFilled(subject.ogDescription) || isFilled(subject.seoDescription)) scores.meta.score += 1;
  else add("og_description_missing", "No Open Graph description", "low", "meta");

  if (isFilled(subject.seoImageUrl)) scores.meta.score += 3;
  else add("og_image_missing", "No share image", "medium", "meta");

  // ── schema (16) ──────────────────────────────────────────────────────────
  // Every page still renders a baseline WebPage/Article node, so the absence of
  // an explicit override is a half-credit, not a zero.
  if (hasJsonLd(subject.jsonLd)) {
    scores.schema.score += 8;
  } else {
    scores.schema.score += 4;
    add("json_ld_default", "Using the generated schema, no tailored JSON-LD", "low", "schema");
  }

  const faq = validFaq(subject.geoFaq);
  if (faq.length >= 1) scores.schema.score += 8;
  else add("faq_schema_missing", "No FAQ pairs, so no FAQPage schema", "high", "schema");

  // ── geo (22) — the heaviest category, on purpose ─────────────────────────
  if (isFilled(subject.geoAnswerSummary)) {
    scores.geo.score += 8;
    const summaryWords = countWords(subject.geoAnswerSummary);
    if (summaryWords >= 40 && summaryWords <= 200) scores.geo.score += 6;
    else add("answer_summary_length", "Answer summary is outside 40–200 words", "medium", "geo");
  } else {
    add("answer_summary_missing", "No self-contained answer summary to quote", "high", "geo");
  }

  if (faq.length >= 3) {
    scores.geo.score += 8;
  } else if (faq.length >= 1) {
    scores.geo.score += 4;
    add("faq_thin", "Fewer than three question and answer pairs", "medium", "geo");
  } else {
    add("faq_missing", "No question and answer pairs", "high", "geo");
  }

  // ── content (14) ─────────────────────────────────────────────────────────
  const body = extractBodySignals(subject.bodyJson, subject.legacyHtml);
  if (body.words >= 600) {
    scores.content.score += 6;
  } else if (body.words >= 250) {
    scores.content.score += 3;
    add("body_thin", "Body is under 600 words", "medium", "content");
  } else {
    add("body_missing", "Body is under 250 words", "high", "content");
  }
  if (body.headings >= 1) scores.content.score += 4;
  else add("headings_missing", "No headings", "medium", "content");
  if (body.lists >= 1) scores.content.score += 4;
  else add("lists_missing", "No lists", "low", "content");

  // ── signals (8) ──────────────────────────────────────────────────────────
  if ((subject.status ?? "").toLowerCase() === "published") scores.signals.score += 3;
  else add("not_published", "Not published", "high", "signals");

  const age = daysSince(subject.updatedAt, now);
  if (age !== null && age <= 90) scores.signals.score += 3;
  else add("stale", "Not updated in the last 90 days", "medium", "signals");

  if (subject.localeCount >= 2) scores.signals.score += 2;
  else add("single_locale", "Only one language version", "low", "signals");

  // ── robots (8) ───────────────────────────────────────────────────────────
  if (isIndexable(subject.robotsDirectives, subject.status)) scores.robots.score += 5;
  else add("not_indexable", "Marked noindex", "high", "robots");
  if (site.robotsHasAiRules) scores.robots.score += 3;
  else add("robots_no_ai_rules", "Site robots.txt does not name the AI crawlers", "high", "robots");

  // ── llms (6) ─────────────────────────────────────────────────────────────
  if (site.servesLlmsTxt) scores.llms.score += 6;
  else add("llms_txt_missing", "Site does not serve llms.txt", "medium", "llms");

  // ── brand (6) ────────────────────────────────────────────────────────────
  if (site.hasOrganizationSchema) scores.brand.score += 3;
  else add("organization_schema_missing", "No Organization schema for the site", "medium", "brand");
  const brand = site.brandName.trim().toLowerCase();
  if (brand && effectiveTitle.toLowerCase().includes(brand)) scores.brand.score += 3;
  else add("brand_absent_from_title", "Brand name is not in the title", "low", "brand");

  gaps.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code),
  );

  const scoreTotal = (Object.keys(scores) as SeoCategory[]).reduce(
    (sum, key) => sum + scores[key].score,
    0,
  );

  return { scoreTotal, scores, gaps };
}

// ── Drift ──────────────────────────────────────────────────────────────────

export interface SeoDrift {
  scoreDelta: number;
  added: SeoGap[];
  resolved: SeoGap[];
}

/**
 * What changed since the previous audit of the same entity and locale. A first
 * audit has no previous version, so everything is zero and nothing is "added".
 */
export function computeDrift(
  previous: { scoreTotal: number; gaps: SeoGap[] } | null | undefined,
  next: { scoreTotal: number; gaps: SeoGap[] },
): SeoDrift {
  if (!previous) return { scoreDelta: 0, added: [], resolved: [] };
  const before = new Set(previous.gaps.map((gap) => gap.code));
  const after = new Set(next.gaps.map((gap) => gap.code));
  return {
    scoreDelta: next.scoreTotal - previous.scoreTotal,
    added: next.gaps.filter((gap) => !before.has(gap.code)),
    resolved: previous.gaps.filter((gap) => !after.has(gap.code)),
  };
}
