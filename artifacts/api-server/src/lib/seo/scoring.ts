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
  /**
   * Structure the page renders from FIELDS rather than from prose. A unit
   * listing has no body to put a heading or a bullet list in, yet its page
   * shows a title and a specification list built from its columns. Counting
   * only prose marked those pages down for a shape they cannot have.
   */
  structuredHeadings?: number;
  structuredLists?: number;
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
  /** The site has an address, so a canonical link can always be built. */
  canBuildCanonical: boolean;
  /** Other spellings of the brand: the Korean name, a trading name. */
  brandAliases: string[];
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
  /** Image URLs found in the body, in document order. */
  images: string[];
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
// score a whole CJK paragraph as one word; those scripts are counted by
// character instead. Korean does use spaces and is handled separately below.
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g;

const HANGUL = /[가-힣ᄀ-ᇿ]/;

/** One CJK character, in English-word equivalents. */
const CJK_CHAR_WORDS = 0.6;
/** One Korean 어절, in English-word equivalents. */
const HANGUL_WORD_WORDS = 1.5;

/**
 * Length in ENGLISH-WORD EQUIVALENTS, not raw tokens.
 *
 * The thresholds this feeds — a 600-word body, a 40 to 200 word summary — come
 * from English writing advice. Applied to raw token counts they mark every
 * Korean page as thin when it says exactly as much, because a Korean 어절
 * carries a noun plus its particles. So each script is converted to the number
 * of English words it would take to say the same thing.
 */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const cjkChars = text.match(CJK)?.length ?? 0;
  const rest = text.replace(CJK, " ");
  let words = 0;
  for (const token of rest.split(/\s+/)) {
    if (!token) continue;
    words += HANGUL.test(token) ? HANGUL_WORD_WORDS : 1;
  }
  return Math.round(words + cjkChars * CJK_CHAR_WORDS);
}

/**
 * Length as a search engine sees it: display width, where a CJK or Hangul glyph
 * occupies the room of two Latin ones.
 *
 * Result snippets are cut by pixel width, not by character count. Judging a
 * Korean title by characters marked every well-written Korean title as too
 * short — 26 Korean characters take the width of about 52 Latin ones, which is
 * exactly the length a title wants to be.
 */
export function displayWidth(text: string | null | undefined): number {
  if (!text) return 0;
  let width = 0;
  for (const ch of text.trim()) {
    const code = ch.codePointAt(0) ?? 0;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x3fffd);
    width += wide ? 2 : 1;
  }
  return width;
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

const IMAGE_URL = /^https?:\/\/\S+\.(jpe?g|png|webp|avif|gif)(\?|$)/i;

export function looksLikeImageUrl(value: string): boolean {
  return IMAGE_URL.test(value.trim());
}

/**
 * The first picture anywhere in a JSON blob. Legacy page copy stores its images
 * under whatever key the tenant's template used (`hero_slide_1_image`,
 * `intro_image`, …), so looking for a fixed key name finds nothing.
 */
export function firstImageUrl(value: unknown): string | null {
  if (typeof value === "string") return looksLikeImageUrl(value) ? value.trim() : null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstImageUrl(entry);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const inner of Object.values(value as Record<string, unknown>)) {
      const found = firstImageUrl(inner);
      if (found) return found;
    }
  }
  return null;
}

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
  const images: string[] = [];
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
      // The pictures are still worth keeping: a page with a hero image has a
      // share card even when nobody filled the share-image field.
      if (looksLikeImageUrl(value)) {
        images.push(value.trim());
        return;
      }
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
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
      if (match[1]) images.push(match[1]);
    }
    parts.push(stripHtml(html));
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return { text, words: countWords(text), headings, lists, images };
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
    // Over-length is a real defect: the result gets cut off. Under-length only
    // leaves room unused, so it is worth saying but not worth alarming about.
    const titleWidth = displayWidth(effectiveTitle);
    if (titleWidth >= 30 && titleWidth <= 60) scores.meta.score += 2;
    else if (titleWidth > 60) add("title_too_long", "Title will be cut off in results", "medium", "meta");
    else add("title_too_short", "Title is shorter than the space results give it", "low", "meta");
  } else {
    add("title_missing", "No title", "high", "meta");
  }

  if (isFilled(subject.seoDescription)) {
    scores.meta.score += 5;
    const descWidth = displayWidth(subject.seoDescription);
    if (descWidth >= 120 && descWidth <= 165) scores.meta.score += 2;
    else if (descWidth > 165)
      add("description_too_long", "Description will be cut off in results", "medium", "meta");
    else
      add("description_too_short", "Description is shorter than the snippet allows", "low", "meta");
  } else {
    add("description_missing", "No meta description", "high", "meta");
  }

  // A canonical link is rendered for every page once the site has an address,
  // so the absence of an EXPLICIT one costs a point rather than failing. It only
  // truly fails when there is no site address to build one from.
  if (isFilled(subject.canonicalUrl)) {
    scores.meta.score += 2;
  } else if (site.canBuildCanonical) {
    scores.meta.score += 1;
    add("canonical_generated", "Using the generated canonical URL", "low", "meta");
  } else {
    add("canonical_missing", "No canonical URL and no site address", "medium", "meta");
  }

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
  const headings = body.headings + (subject.structuredHeadings ?? 0);
  const lists = body.lists + (subject.structuredLists ?? 0);
  if (headings >= 1) scores.content.score += 4;
  else add("headings_missing", "No headings", "medium", "content");
  if (lists >= 1) scores.content.score += 4;
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
  // A Korean page writes the brand in Korean while the site record spells it in
  // Latin, so matching the site label alone marks every localised title as
  // brandless. The other spellings come from the site's own SEO defaults.
  const aliases = [site.brandName, ...(site.brandAliases ?? [])]
    .map((alias) => alias?.trim().toLowerCase())
    .filter((alias): alias is string => Boolean(alias));
  const loweredTitle = effectiveTitle.toLowerCase();
  if (aliases.some((alias) => loweredTitle.includes(alias))) scores.brand.score += 3;
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
