import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import * as z from "zod/v4";
import {
  db,
  cmsSitesTable,
  cmsPagesTable,
  cmsPageTranslationsTable,
  blogPostsTable,
  saleListingsTable,
} from "@workspace/db";
import {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSeoHead,
  buildSitemapXml,
  renderCrawlerHtml,
  type LlmsSection,
  type SitemapEntry,
} from "../lib/seo/builders.js";
import { extractBodySignals } from "../lib/seo/scoring.js";
import { publicPathForPage } from "../lib/seo/publicRoutes.js";
import {
  applyApprovedDraft,
  auditAndPersist,
  auditHistory,
  isSeoEntityType,
  latestAuditsBySite,
  loadSiteMeta,
  resolveAllEntities,
  resolveOneEntity,
  type ResolvedEntity,
  type SeoSiteMeta,
} from "../lib/seo/service.js";

// ---------------------------------------------------------------------------
// Two routers from one file, the house pattern:
//
//   adminRouter  — /api/v1/seo/*, behind the staff JWT guard.
//   publicRouter — /robots.txt, /llms.txt, /sitemap.xml and the crawler head.
//                  Bare paths, outside /api, because that is what a crawler
//                  asks for and it carries no session.
// ---------------------------------------------------------------------------

const adminRouter: IRouter = Router();
const publicRouter: IRouter = Router();

// ── Admin ──────────────────────────────────────────────────────────────────

function siteParam(req: Request): string {
  return String(req.query["site"] ?? req.body?.site ?? "").trim();
}

async function requireSite(req: Request, res: Response): Promise<SeoSiteMeta | null> {
  const siteKey = siteParam(req);
  if (!siteKey) {
    res.status(400).json({ error: "site is required" });
    return null;
  }
  const site = await loadSiteMeta(siteKey);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return null;
  }
  return site;
}

function actorOf(req: Request): string | null {
  const user = (req as unknown as { user?: { email?: string; name?: string } }).user;
  return user?.email ?? user?.name ?? null;
}

/**
 * One row per entity, worst first: never audited, then lowest score, then most
 * high-severity gaps. The screen is a work queue, so it opens on what to fix.
 */
adminRouter.get("/v1/seo/overview", async (req, res): Promise<void> => {
  const site = await requireSite(req, res);
  if (!site) return;

  const [entities, latest] = await Promise.all([
    resolveAllEntities(site),
    latestAuditsBySite(site.siteKey),
  ]);

  const rows = entities.map((entity) => {
    const audit = latest.get(`${entity.display.entityType}:${entity.display.entityId}`) ?? null;
    const gaps = audit?.gaps ?? [];
    return {
      ...entity.display,
      locale: entity.subject.locale,
      scoreTotal: audit?.scoreTotal ?? null,
      version: audit?.version ?? null,
      gapCount: gaps.length,
      highGapCount: gaps.filter((gap) => gap.severity === "high").length,
      hasDrafts: Boolean(audit && Object.keys(audit.generated).length > 0),
      auditedAt: audit?.auditedAt ?? null,
      source: audit?.source ?? null,
    };
  });

  rows.sort((a, b) => {
    if (a.scoreTotal === null && b.scoreTotal !== null) return -1;
    if (b.scoreTotal === null && a.scoreTotal !== null) return 1;
    if (a.scoreTotal !== b.scoreTotal) return (a.scoreTotal ?? 0) - (b.scoreTotal ?? 0);
    return b.highGapCount - a.highGapCount;
  });

  const scored = rows.filter((row) => row.scoreTotal !== null);
  res.json({
    site: {
      site_key: site.siteKey,
      label: site.label,
      origin: site.origin,
      default_locale: site.defaultLocale,
      is_primary: site.isPrimary,
      has_organization_schema: site.context.hasOrganizationSchema,
      serves_llms_txt: site.context.servesLlmsTxt,
      robots_has_ai_rules: site.context.robotsHasAiRules,
    },
    averageScore:
      scored.length > 0
        ? Math.round(scored.reduce((sum, row) => sum + (row.scoreTotal ?? 0), 0) / scored.length)
        : null,
    auditedCount: scored.length,
    totalCount: rows.length,
    rows,
  });
});

adminRouter.get("/v1/seo/:type/:id/history", async (req, res): Promise<void> => {
  const site = await requireSite(req, res);
  if (!site) return;
  const type = String(req.params["type"]);
  if (!isSeoEntityType(type)) {
    res.status(400).json({ error: "Unknown entity type" });
    return;
  }
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [entity, history] = await Promise.all([
    resolveOneEntity(site, type, id),
    auditHistory(site.siteKey, type, id),
  ]);
  if (!entity) {
    res.status(404).json({ error: "Entity not found on this site" });
    return;
  }
  res.json({ entity: entity.display, history });
});

const RefreshBody = z.object({ site: z.string().min(1), generate: z.boolean().optional() });

adminRouter.post("/v1/seo/:type/:id/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const site = await loadSiteMeta(parsed.data.site);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  const type = String(req.params["type"]);
  if (!isSeoEntityType(type)) {
    res.status(400).json({ error: "Unknown entity type" });
    return;
  }
  const entity = await resolveOneEntity(site, type, Number(req.params["id"]));
  if (!entity) {
    res.status(404).json({ error: "Entity not found on this site" });
    return;
  }
  const audit = await auditAndPersist(site, entity, {
    generate: parsed.data.generate === true,
    source: "manual",
    auditedBy: actorOf(req),
  });
  res.json({ entity: entity.display, audit });
});

/**
 * Audit every entity on the site. Audit-only by default: generating drafts for
 * a whole site is a real spend, so it takes an explicit `generate`.
 */
adminRouter.post("/v1/seo/refresh-all", async (req, res): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const site = await loadSiteMeta(parsed.data.site);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  const entities = await resolveAllEntities(site);
  const actor = actorOf(req);
  const failures: { entity: string; error: string }[] = [];
  let audited = 0;

  for (const entity of entities) {
    try {
      await auditAndPersist(site, entity, {
        generate: parsed.data.generate === true,
        source: "manual",
        auditedBy: actor,
      });
      audited += 1;
    } catch (err) {
      // One bad row must not abandon the rest of the site.
      failures.push({
        entity: `${entity.display.entityType}:${entity.display.entityId}`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  res.json({ audited, total: entities.length, failures });
});

const ApplyBody = z.object({
  site: z.string().min(1),
  seo_description: z.string().optional(),
  geo_answer_summary: z.string().optional(),
  geo_faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
});

/** Approve AI drafts: write them to the entity, then re-audit so the score moves. */
adminRouter.post("/v1/seo/:type/:id/apply", async (req, res): Promise<void> => {
  const parsed = ApplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const site = await loadSiteMeta(parsed.data.site);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  const type = String(req.params["type"]);
  if (!isSeoEntityType(type)) {
    res.status(400).json({ error: "Unknown entity type" });
    return;
  }
  const id = Number(req.params["id"]);
  const { site: _site, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to apply" });
    return;
  }
  const applied = await applyApprovedDraft(site, type, id, patch);
  if (!applied) {
    res.status(404).json({ error: "Entity not found on this site" });
    return;
  }
  const entity = await resolveOneEntity(site, type, id);
  const audit = entity
    ? await auditAndPersist(site, entity, { source: "manual", auditedBy: actorOf(req) })
    : null;
  res.json({ applied: true, audit });
});

// ── Public crawler surface ─────────────────────────────────────────────────
//
// The site is identified by a QUERY PARAMETER, never by a forwarded host
// header: these paths are reached through a CDN rewrite, and the original host
// does not reliably survive that hop.

async function resolveRequestSite(req: Request): Promise<SeoSiteMeta | null> {
  const requested = String(req.query["site"] ?? "").trim();
  if (requested) return loadSiteMeta(requested);
  const [fallback] = await db
    .select({ site_key: cmsSitesTable.site_key })
    .from(cmsSitesTable)
    .where(eq(cmsSitesTable.is_active, true))
    .orderBy(asc(cmsSitesTable.sort_order), asc(cmsSitesTable.id))
    .limit(1);
  return fallback ? loadSiteMeta(fallback.site_key) : null;
}

/**
 * Every response here must say so explicitly: the app sets a blanket
 * `X-Robots-Tag: noindex` for the admin surface, which would otherwise tell a
 * crawler to ignore the very files we are serving it.
 */
function crawlerHeaders(res: Response, contentType: string, authoritative: boolean): void {
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Robots-Tag", "all");
  res.setHeader(
    "Cache-Control",
    authoritative ? "public, max-age=600, s-maxage=3600" : "no-store",
  );
}

function originFor(site: SeoSiteMeta | null, req: Request): string {
  if (site?.origin) return site.origin;
  const host = String(req.query["host"] ?? req.headers["host"] ?? "").trim();
  return host ? `https://${host.replace(/\/+$/, "")}` : "";
}

publicRouter.get("/robots.txt", async (req, res): Promise<void> => {
  const site = await resolveRequestSite(req);
  const origin = originFor(site, req);
  // Without a known origin the Sitemap line would be wrong, so the answer is
  // still valid but must not be cached as if it were final.
  crawlerHeaders(res, "text/plain; charset=utf-8", Boolean(site && origin));
  if (site && site.context.robotsHasAiRules === false) {
    res.send("User-agent: *\nAllow: /\n");
    return;
  }
  res.send(buildRobotsTxt(origin || "https://example.invalid", site?.robotsExtra ?? null));
});

publicRouter.get("/llms.txt", async (req, res): Promise<void> => {
  const site = await resolveRequestSite(req);
  if (!site) {
    crawlerHeaders(res, "text/plain; charset=utf-8", false);
    res.status(404).send("# Unknown site\n");
    return;
  }
  const origin = originFor(site, req);
  const entities = await resolveAllEntities(site);
  const published = entities.filter(
    (entity) => (entity.display.status ?? "").toLowerCase() === "published",
  );

  const section = (heading: string, type: string): LlmsSection => ({
    heading,
    entries: published
      .filter((entity) => entity.display.entityType === type)
      .map((entity) => ({
        title: entity.display.title || entity.display.slug,
        url: `${origin}${entity.display.path}`,
        // The answer summary is exactly what an engine wants as the blurb.
        note:
          entity.subject.geoAnswerSummary?.trim().slice(0, 200) ??
          entity.subject.seoDescription?.trim().slice(0, 200) ??
          null,
      })),
  });

  crawlerHeaders(res, "text/plain; charset=utf-8", Boolean(origin));
  res.send(
    buildLlmsTxt(site.label, site.llmsTxtIntro, [
      section("Pages", "page"),
      section("Listings", "listing"),
      section("Articles", "blog"),
    ]),
  );
});

publicRouter.get("/sitemap.xml", async (req, res): Promise<void> => {
  const site = await resolveRequestSite(req);
  if (!site) {
    crawlerHeaders(res, "application/xml; charset=utf-8", false);
    res.status(404).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset/>\n');
    return;
  }
  const origin = originFor(site, req);

  const pages = await db
    .select({
      slug: cmsPagesTable.slug,
      updated_at: cmsPagesTable.updated_at,
      id: cmsPagesTable.id,
    })
    .from(cmsPagesTable)
    .where(
      and(
        eq(cmsPagesTable.site_key, site.siteKey),
        eq(cmsPagesTable.status, "Published"),
        isNull(cmsPagesTable.deleted_at),
      ),
    )
    .orderBy(asc(cmsPagesTable.sort_order));

  const translations = await db
    .select({
      page_id: cmsPageTranslationsTable.page_id,
      locale: cmsPageTranslationsTable.locale,
      status: cmsPageTranslationsTable.status,
    })
    .from(cmsPageTranslationsTable);
  const localesByPage = new Map<number, string[]>();
  for (const row of translations) {
    if (row.status !== "Published") continue;
    const list = localesByPage.get(row.page_id) ?? [];
    list.push(row.locale);
    localesByPage.set(row.page_id, list);
  }

  const entries: SitemapEntry[] = pages.map((page) => ({
    path: publicPathForPage(site.siteKey, page.slug),
    updatedAt: page.updated_at,
    locales: localesByPage.get(page.id) ?? [],
  }));

  const posts = await db
    .select({ slug: blogPostsTable.slug, updated_at: blogPostsTable.updated_at })
    .from(blogPostsTable)
    .where(
      and(
        eq(blogPostsTable.site_key, site.siteKey),
        eq(blogPostsTable.status, "Published"),
        isNull(blogPostsTable.deleted_at),
      ),
    );
  for (const post of posts) {
    entries.push({ path: `/blog/${post.slug}`, updatedAt: post.updated_at });
  }

  if (site.isPrimary) {
    const listings = await db
      .select({ id: saleListingsTable.id, updated_at: saleListingsTable.updated_at })
      .from(saleListingsTable)
      .where(and(eq(saleListingsTable.published, true), isNull(saleListingsTable.deleted_at)));
    for (const listing of listings) {
      entries.push({ path: `/buy/${listing.id}`, updatedAt: listing.updated_at });
    }
  }

  crawlerHeaders(res, "application/xml; charset=utf-8", Boolean(origin));
  res.send(buildSitemapXml(origin || "https://example.invalid", entries));
});

/**
 * Which routes the build step should prerender for this site: the public path,
 * the CMS slug, and the legacy page key its older copy lives under. Serving it
 * from here keeps ONE map of slug-to-URL instead of one in the API and a second
 * in the build script that quietly drifts from it.
 */
publicRouter.get("/seo/routes", async (req, res): Promise<void> => {
  const site = await resolveRequestSite(req);
  if (!site) {
    crawlerHeaders(res, "application/json; charset=utf-8", false);
    res.status(404).json({ error: "Unknown site" });
    return;
  }
  const pages = await db
    .select({
      slug: cmsPagesTable.slug,
      legacy_page_key: cmsPagesTable.legacy_page_key,
      status: cmsPagesTable.status,
    })
    .from(cmsPagesTable)
    .where(
      and(
        eq(cmsPagesTable.site_key, site.siteKey),
        eq(cmsPagesTable.status, "Published"),
        isNull(cmsPagesTable.deleted_at),
      ),
    )
    .orderBy(asc(cmsPagesTable.sort_order), asc(cmsPagesTable.id));

  crawlerHeaders(res, "application/json; charset=utf-8", true);
  res.json({
    site: site.siteKey,
    routes: pages.map((page) => ({
      path: publicPathForPage(site.siteKey, page.slug),
      slug: page.slug,
      legacyPageKey: page.legacy_page_key,
    })),
  });
});

/**
 * The same head, as JSON, for the build step that bakes it into the static HTML.
 *
 * Vercel checks the filesystem BEFORE it applies a rewrite, so a route that was
 * prerendered to its own index.html can never be intercepted at request time —
 * the crawler rewrite only wins for paths with no file behind them. Those routes
 * therefore get their metadata baked in at build time instead, which is better
 * anyway: it is static, cached, and reaches every crawler rather than only the
 * user-agents we thought to list.
 */
publicRouter.get("/seo/meta", async (req, res): Promise<void> => {
  const site = await resolveRequestSite(req);
  if (!site) {
    crawlerHeaders(res, "application/json; charset=utf-8", false);
    res.status(404).json({ error: "Unknown site" });
    return;
  }
  const path = String(req.query["path"] ?? "/") || "/";
  const entities = await resolveAllEntities(site);
  const match = entities.find((entity) => entity.display.path === path) ?? null;
  if (!match) {
    crawlerHeaders(res, "application/json; charset=utf-8", false);
    res.status(404).json({ error: "Not found" });
    return;
  }
  const head = buildSeoHead({
    subject: match.subject,
    origin: originFor(site, req),
    path,
    brandName: site.label,
    brandAliases: site.context.brandAliases,
    siteLabel: site.label,
    organizationSchema: site.organizationSchema,
    alternateLocales: site.locales,
  });
  crawlerHeaders(res, "application/json; charset=utf-8", true);
  res.json({
    ...head,
    keywords: match.subject.seoKeywords ?? null,
    answerSummary: match.subject.geoAnswerSummary ?? null,
    faq: match.subject.geoFaq ?? [],
    locale: match.subject.locale,
  });
});

/**
 * A no-JavaScript rendering of one page, for crawlers that never run scripts —
 * which is most of the AI ones. The CDN routes a crawler user-agent here; a
 * browser never sees it.
 */
publicRouter.get("/seo/head", async (req, res): Promise<void> => {
  const site = await resolveRequestSite(req);
  if (!site) {
    crawlerHeaders(res, "text/html; charset=utf-8", false);
    res.status(404).send("<!doctype html><title>Unknown site</title>");
    return;
  }
  const path = String(req.query["path"] ?? "/") || "/";
  const entities = await resolveAllEntities(site);
  const match = entities.find((entity) => entity.display.path === path) ?? null;

  if (!match) {
    crawlerHeaders(res, "text/html; charset=utf-8", false);
    res.status(404).send("<!doctype html><title>Not found</title>");
    return;
  }

  const head = buildSeoHead({
    subject: match.subject,
    origin: originFor(site, req),
    path,
    brandName: site.label,
    brandAliases: site.context.brandAliases,
    siteLabel: site.label,
    organizationSchema: site.organizationSchema,
    alternateLocales: site.locales,
  });
  const body = extractBodySignals(match.subject.bodyJson, match.subject.legacyHtml);
  crawlerHeaders(res, "text/html; charset=utf-8", true);
  res.send(renderCrawlerHtml(head, match.subject, body.text.slice(0, 8000)));
});

export { adminRouter as seoAdminRouter, publicRouter as seoPublicRouter };
