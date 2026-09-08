// ---------------------------------------------------------------------------
// The SEO / GEO orchestration layer: read the content, score it, append an
// audit version. This is the only file in lib/seo that touches the database.
//
// The audit unit is ONE ENTITY AT THE SITE'S DEFAULT LOCALE, so a dashboard row
// is a page rather than a page-language pair. Values resolve the way the rest
// of the CMS resolves them: translation value ?? base value.
// ---------------------------------------------------------------------------

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  cmsSitesTable,
  cmsSiteSettingsTable,
  cmsPagesTable,
  cmsPageTranslationsTable,
  cmsPostTranslationsTable,
  blogPostsTable,
  saleListingsTable,
  seoAuditsTable,
} from "@workspace/db";
import {
  auditSeoGeo,
  computeDrift,
  type SeoAuditResult,
  type SeoDrift,
  type SeoEntityType,
  type SeoFaqPair,
  type SeoGap,
  type SeoSiteContext,
  type SeoSubject,
} from "./scoring.js";
import { generateSeoGeoDrafts, type SeoDrafts } from "./drafts.js";

export const SEO_ENTITY_TYPES: SeoEntityType[] = ["page", "blog", "listing"];

export function isSeoEntityType(value: string): value is SeoEntityType {
  return (SEO_ENTITY_TYPES as string[]).includes(value);
}

// ── Site meta ──────────────────────────────────────────────────────────────

export interface SeoSiteMeta {
  siteKey: string;
  label: string;
  /** Absolute origin with no trailing slash, e.g. https://metheim-web.vercel.app */
  origin: string;
  defaultLocale: string;
  locales: string[];
  context: SeoSiteContext;
  organizationSchema: Record<string, unknown> | null;
  robotsExtra: string | null;
  llmsTxtIntro: string | null;
  /** True when this site owns the instance's listings board. */
  isPrimary: boolean;
}

interface SeoDefaults {
  organizationSchema?: Record<string, unknown>;
  robotsExtra?: string;
  llmsTxtIntro?: string;
  defaultCanonicalBase?: string;
  /** Escape hatch: stop advertising the AI crawlers for this site. */
  crawlerFilesDisabled?: boolean;
}

function readDefaults(value: unknown): SeoDefaults {
  return value && typeof value === "object" ? (value as SeoDefaults) : {};
}

function normaliseOrigin(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * The site that owns instance-wide public content (the listings board). Lowest
 * sort_order among active sites: `www` on MillionStay, `dev` on Metheim. This
 * avoids inventing a site_key column on sale_listings, which has none.
 */
async function primarySiteKey(): Promise<string | null> {
  const [row] = await db
    .select({ site_key: cmsSitesTable.site_key })
    .from(cmsSitesTable)
    .where(eq(cmsSitesTable.is_active, true))
    .orderBy(asc(cmsSitesTable.sort_order), asc(cmsSitesTable.id))
    .limit(1);
  return row?.site_key ?? null;
}

export async function loadSiteMeta(siteKey: string): Promise<SeoSiteMeta | null> {
  const [site] = await db.select().from(cmsSitesTable).where(eq(cmsSitesTable.site_key, siteKey));
  if (!site) return null;

  const [settings] = await db
    .select()
    .from(cmsSiteSettingsTable)
    .where(eq(cmsSiteSettingsTable.site_key, siteKey));

  const defaults = readDefaults(settings?.seo_defaults);
  const origin = normaliseOrigin(defaults.defaultCanonicalBase || site.host);
  const organizationSchema =
    defaults.organizationSchema && Object.keys(defaults.organizationSchema).length > 0
      ? defaults.organizationSchema
      : null;
  const llmsTxtIntro = (defaults.llmsTxtIntro ?? "").trim() || null;
  const locales = Array.isArray(site.locales) ? (site.locales as string[]) : [site.default_locale];

  return {
    siteKey,
    label: site.label,
    origin,
    defaultLocale: site.default_locale,
    locales,
    organizationSchema,
    robotsExtra: (defaults.robotsExtra ?? "").trim() || null,
    llmsTxtIntro,
    isPrimary: (await primarySiteKey()) === siteKey,
    context: {
      brandName: site.label,
      hasOrganizationSchema: Boolean(organizationSchema),
      // The API serves a robots.txt that names every AI crawler. A site can opt
      // out, and then its pages lose the point for it.
      robotsHasAiRules: defaults.crawlerFilesDisabled !== true,
      // llms.txt is only worth a score when someone curated the intro; an
      // auto-listing of every page is what sitemap.xml is already for.
      servesLlmsTxt: defaults.crawlerFilesDisabled !== true && Boolean(llmsTxtIntro),
    },
  };
}

// ── Entity resolution ──────────────────────────────────────────────────────

export interface ResolvedEntity {
  subject: SeoSubject;
  display: {
    entityType: SeoEntityType;
    entityId: number;
    title: string;
    slug: string;
    path: string;
    status: string;
    localeCount: number;
    /** Admin address for the row's edit screen. */
    editHref: string;
  };
}

function faqOf(value: unknown): SeoFaqPair[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({ q: String(entry["q"] ?? ""), a: String(entry["a"] ?? "") }))
    .filter((pair) => pair.q.trim() && pair.a.trim());
}

function pagePath(slug: string): string {
  const clean = (slug ?? "").replace(/^\/+/, "");
  return clean && clean !== "home" ? `/${clean}` : "/";
}

/** Every auditable entity for one site, resolved at the site's default locale. */
export async function resolveAllEntities(site: SeoSiteMeta): Promise<ResolvedEntity[]> {
  const locale = site.defaultLocale;
  const out: ResolvedEntity[] = [];

  // ── Pages ────────────────────────────────────────────────────────────────
  const pages = await db
    .select()
    .from(cmsPagesTable)
    .where(and(eq(cmsPagesTable.site_key, site.siteKey), isNull(cmsPagesTable.deleted_at)))
    .orderBy(asc(cmsPagesTable.sort_order), asc(cmsPagesTable.id));

  if (pages.length > 0) {
    const translations = await db
      .select()
      .from(cmsPageTranslationsTable)
      .where(
        inArray(
          cmsPageTranslationsTable.page_id,
          pages.map((page) => page.id),
        ),
      );
    const byPage = new Map<number, typeof translations>();
    for (const row of translations) {
      const list = byPage.get(row.page_id) ?? [];
      list.push(row);
      byPage.set(row.page_id, list);
    }
    for (const page of pages) {
      const rows = byPage.get(page.id) ?? [];
      const tr = rows.find((row) => row.locale === locale) ?? null;
      out.push({
        subject: {
          entityType: "page",
          entityId: page.id,
          locale,
          slug: page.slug,
          title: tr?.title ?? page.title,
          seoTitle: tr?.seo_title ?? page.seo_title,
          seoDescription: tr?.seo_description ?? page.seo_description,
          seoKeywords: tr?.seo_keywords ?? page.seo_keywords,
          seoImageUrl: tr?.seo_image_url ?? page.seo_image_url,
          ogTitle: tr?.og_title ?? null,
          ogDescription: tr?.og_description ?? null,
          canonicalUrl: page.canonical_url,
          robotsDirectives: page.robots_directives,
          jsonLd: tr?.json_ld ?? page.json_ld,
          geoAnswerSummary: tr?.geo_answer_summary ?? page.geo_answer_summary,
          geoFaq: faqOf(page.geo_faq),
          status: tr?.status ?? page.status,
          updatedAt: tr?.updated_at ?? page.updated_at,
          localeCount: rows.length,
          bodyJson: tr?.body_json ?? null,
          legacyHtml: null,
        },
        display: {
          entityType: "page",
          entityId: page.id,
          title: tr?.title ?? page.title ?? page.slug ?? "",
          slug: page.slug,
          path: pagePath(page.slug),
          status: page.status,
          localeCount: rows.length,
          editHref: `/cms/pages/${page.id}`,
        },
      });
    }
  }

  // ── Blog posts ───────────────────────────────────────────────────────────
  const posts = await db
    .select()
    .from(blogPostsTable)
    .where(and(eq(blogPostsTable.site_key, site.siteKey), isNull(blogPostsTable.deleted_at)))
    .orderBy(desc(blogPostsTable.id));

  if (posts.length > 0) {
    const translations = await db
      .select()
      .from(cmsPostTranslationsTable)
      .where(
        inArray(
          cmsPostTranslationsTable.post_id,
          posts.map((post) => post.id),
        ),
      );
    const byPost = new Map<number, typeof translations>();
    for (const row of translations) {
      const list = byPost.get(row.post_id) ?? [];
      list.push(row);
      byPost.set(row.post_id, list);
    }
    for (const post of posts) {
      const rows = byPost.get(post.id) ?? [];
      const tr = rows.find((row) => row.locale === locale) ?? null;
      // Older posts keep their per-locale copy in a jsonb blob rather than a
      // translation row; count those so the locale signal is not falsely zero.
      const legacyLocales =
        post.translations && typeof post.translations === "object"
          ? Object.keys(post.translations as object).length
          : 0;
      const localeCount = Math.max(rows.length, legacyLocales);
      out.push({
        subject: {
          entityType: "blog",
          entityId: post.id,
          locale,
          slug: post.slug,
          title: tr?.title ?? post.title,
          seoTitle: tr?.seo_title ?? post.seo_title,
          seoDescription: tr?.seo_description ?? post.seo_description ?? post.excerpt,
          seoKeywords: tr?.seo_keywords ?? post.seo_keywords,
          seoImageUrl: tr?.seo_image_url ?? post.cover_image_url,
          ogTitle: tr?.og_title ?? null,
          ogDescription: tr?.og_description ?? null,
          canonicalUrl: post.canonical_url,
          robotsDirectives: post.robots_directives,
          jsonLd: tr?.json_ld ?? post.json_ld,
          geoAnswerSummary: tr?.geo_answer_summary ?? post.geo_answer_summary,
          geoFaq: faqOf(post.geo_faq),
          status: tr?.status ?? post.status,
          updatedAt: tr?.updated_at ?? post.updated_at,
          localeCount,
          bodyJson: tr?.body_json ?? post.body_json,
          legacyHtml: post.content,
        },
        display: {
          entityType: "blog",
          entityId: post.id,
          title: tr?.title ?? post.title,
          slug: post.slug,
          path: `/blog/${post.slug}`,
          status: post.status,
          localeCount,
          editHref: `/cms/blog/${post.id}`,
        },
      });
    }
  }

  // ── Sale listings ────────────────────────────────────────────────────────
  // They carry no site_key, so they belong to the instance's primary site only.
  if (site.isPrimary) {
    const listings = await db
      .select()
      .from(saleListingsTable)
      .where(isNull(saleListingsTable.deleted_at))
      .orderBy(asc(saleListingsTable.sort_order), asc(saleListingsTable.id));

    for (const listing of listings) {
      const blob =
        listing.translations && typeof listing.translations === "object"
          ? (listing.translations as Record<string, Record<string, unknown>>)
          : {};
      const copy = blob[locale] ?? blob["ko"] ?? blob["en"] ?? {};
      const title = String(copy["title"] ?? "").trim() || `#${listing.id}`;
      const description = String(copy["description"] ?? "").trim() || null;
      out.push({
        subject: {
          entityType: "listing",
          entityId: listing.id,
          locale,
          slug: String(listing.id),
          title,
          seoTitle: null,
          seoDescription: description,
          seoKeywords: null,
          seoImageUrl: listing.cover_image,
          ogTitle: null,
          ogDescription: null,
          canonicalUrl: listing.canonical_url,
          robotsDirectives: listing.robots_directives,
          jsonLd: listing.json_ld,
          geoAnswerSummary: listing.geo_answer_summary,
          geoFaq: faqOf(listing.geo_faq),
          status: listing.published ? "Published" : "Draft",
          updatedAt: listing.updated_at,
          localeCount: Object.keys(blob).length,
          bodyJson: null,
          legacyHtml: description,
        },
        display: {
          entityType: "listing",
          entityId: listing.id,
          title,
          slug: String(listing.id),
          path: `/buy/${listing.id}`,
          status: listing.published ? "Published" : "Draft",
          localeCount: Object.keys(blob).length,
          editHref: `/cms/listings/${listing.id}`,
        },
      });
    }
  }

  return out;
}

export async function resolveOneEntity(
  site: SeoSiteMeta,
  entityType: SeoEntityType,
  entityId: number,
): Promise<ResolvedEntity | null> {
  const all = await resolveAllEntities(site);
  return (
    all.find(
      (entity) =>
        entity.display.entityType === entityType && entity.display.entityId === entityId,
    ) ?? null
  );
}

// ── Audit persistence ──────────────────────────────────────────────────────

export interface StoredAudit {
  version: number;
  scoreTotal: number;
  scores: SeoAuditResult["scores"];
  gaps: SeoGap[];
  drift: SeoDrift;
  generated: SeoDrafts;
  source: string;
  auditedBy: string | null;
  auditedAt: Date;
}

function toStored(row: typeof seoAuditsTable.$inferSelect): StoredAudit {
  return {
    version: row.version,
    scoreTotal: row.score_total,
    scores: row.scores_json as SeoAuditResult["scores"],
    gaps: (row.gaps_json ?? []) as SeoGap[],
    drift: (row.drift_json ?? { scoreDelta: 0, added: [], resolved: [] }) as SeoDrift,
    generated: (row.generated_json ?? {}) as SeoDrafts,
    source: row.source,
    auditedBy: row.audited_by,
    auditedAt: row.audited_at,
  };
}

/**
 * Score one entity and append the result as a new version. This NEVER writes to
 * the entity itself: a refresh is a measurement, and measuring must not change
 * what is measured. AI drafts (when asked for) are stored unapproved.
 */
export async function auditAndPersist(
  site: SeoSiteMeta,
  entity: ResolvedEntity,
  options: { generate?: boolean; source?: "manual" | "scheduled"; auditedBy?: string | null } = {},
): Promise<StoredAudit> {
  const { subject, display } = entity;
  const result = auditSeoGeo(subject, site.context);

  const [previousRow] = await db
    .select()
    .from(seoAuditsTable)
    .where(
      and(
        eq(seoAuditsTable.site_key, site.siteKey),
        eq(seoAuditsTable.entity_type, display.entityType),
        eq(seoAuditsTable.entity_id, display.entityId),
        eq(seoAuditsTable.locale, subject.locale),
      ),
    )
    .orderBy(desc(seoAuditsTable.version))
    .limit(1);

  const previous = previousRow
    ? { scoreTotal: previousRow.score_total, gaps: (previousRow.gaps_json ?? []) as SeoGap[] }
    : null;
  const drift = computeDrift(previous, result);

  // Keep any earlier draft that is still unapproved, so asking for a plain
  // audit does not throw away work the model already did.
  let generated: SeoDrafts = previousRow
    ? ((previousRow.generated_json ?? {}) as SeoDrafts)
    : {};
  if (options.generate) {
    const drafts = await generateSeoGeoDrafts(subject);
    if (Object.keys(drafts).length > 0) generated = drafts;
  }

  const [inserted] = await db
    .insert(seoAuditsTable)
    .values({
      site_key: site.siteKey,
      entity_type: display.entityType,
      entity_id: display.entityId,
      locale: subject.locale,
      version: (previousRow?.version ?? 0) + 1,
      score_total: result.scoreTotal,
      scores_json: result.scores,
      gaps_json: result.gaps,
      drift_json: drift,
      generated_json: generated,
      source: options.source ?? "manual",
      audited_by: options.auditedBy ?? null,
    })
    .returning();

  return toStored(inserted!);
}

/** The newest audit per entity for one site, keyed `<type>:<id>`. */
export async function latestAuditsBySite(siteKey: string): Promise<Map<string, StoredAudit>> {
  const rows = await db
    .select()
    .from(seoAuditsTable)
    .where(eq(seoAuditsTable.site_key, siteKey))
    .orderBy(desc(seoAuditsTable.version));

  const latest = new Map<string, StoredAudit>();
  for (const row of rows) {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (!latest.has(key)) latest.set(key, toStored(row));
  }
  return latest;
}

export async function auditHistory(
  siteKey: string,
  entityType: SeoEntityType,
  entityId: number,
): Promise<StoredAudit[]> {
  const rows = await db
    .select()
    .from(seoAuditsTable)
    .where(
      and(
        eq(seoAuditsTable.site_key, siteKey),
        eq(seoAuditsTable.entity_type, entityType),
        eq(seoAuditsTable.entity_id, entityId),
      ),
    )
    .orderBy(desc(seoAuditsTable.version))
    .limit(50);
  return rows.map(toStored);
}

// ── Applying an approved draft ─────────────────────────────────────────────

export interface ApplyPatch {
  seo_description?: string;
  geo_answer_summary?: string;
  geo_faq?: SeoFaqPair[];
}

/**
 * Write an approved draft onto the entity's BASE row. Base rather than
 * translation, because these fields are inherited by every locale and a person
 * approved this text as the site's own words.
 */
export async function applyApprovedDraft(
  site: SeoSiteMeta,
  entityType: SeoEntityType,
  entityId: number,
  patch: ApplyPatch,
): Promise<boolean> {
  const base: Record<string, unknown> = {};
  if (typeof patch.geo_answer_summary === "string") {
    base["geo_answer_summary"] = patch.geo_answer_summary;
  }
  if (Array.isArray(patch.geo_faq)) base["geo_faq"] = patch.geo_faq;
  const description =
    typeof patch.seo_description === "string" ? patch.seo_description : undefined;

  if (entityType === "page") {
    const values = { ...base } as Record<string, unknown>;
    if (description !== undefined) values["seo_description"] = description;
    if (Object.keys(values).length === 0) return false;
    const updated = await db
      .update(cmsPagesTable)
      .set(values)
      .where(and(eq(cmsPagesTable.id, entityId), eq(cmsPagesTable.site_key, site.siteKey)))
      .returning({ id: cmsPagesTable.id });
    return updated.length > 0;
  }

  if (entityType === "blog") {
    const values = { ...base } as Record<string, unknown>;
    if (description !== undefined) values["seo_description"] = description;
    if (Object.keys(values).length === 0) return false;
    const updated = await db
      .update(blogPostsTable)
      .set(values)
      .where(and(eq(blogPostsTable.id, entityId), eq(blogPostsTable.site_key, site.siteKey)))
      .returning({ id: blogPostsTable.id });
    return updated.length > 0;
  }

  // Listings keep their per-locale copy in a jsonb blob, so a description lands
  // in that blob for the site's default locale rather than in a column.
  const values = { ...base } as Record<string, unknown>;
  if (description !== undefined) {
    values["translations"] = sql`jsonb_set(
      coalesce(${saleListingsTable.translations}, '{}'::jsonb),
      ${`{${site.defaultLocale},description}`},
      ${JSON.stringify(description)}::jsonb,
      true
    )`;
  }
  if (Object.keys(values).length === 0) return false;
  const updated = await db
    .update(saleListingsTable)
    .set(values)
    .where(eq(saleListingsTable.id, entityId))
    .returning({ id: saleListingsTable.id });
  return updated.length > 0;
}
