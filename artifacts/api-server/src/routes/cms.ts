import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull, isNotNull, ilike, or, type SQL } from "drizzle-orm";
import {
  db,
  cmsSitesTable,
  cmsPagesTable,
  cmsPageTranslationsTable,
  cmsPostTranslationsTable,
  cmsBlockTemplatesTable,
  cmsSiteSettingsTable,
  blogPostsTable,
  pageContentsTable,
} from "@workspace/db";
import * as z from "zod/v4";
import {
  BLOCK_SPEC_LIST,
  normaliseBody,
  collectTextRefs,
  applyTextRefs,
  countBlocks,
  resolveTokens,
  type Block,
  type TextRef,
} from "@workspace/cms-blocks";
import { makeBulkDelete, makeBulkRestore, deletedFilter } from "../lib/softDelete.js";
import { syncSiteDomain, getSiteDomainStatus, normaliseHostname } from "../lib/vercelDomains.js";
import { getAnthropic, isChatConfigured, CHAT_MODEL, ChatConfigError } from "../lib/chat/anthropic.js";

// ---------------------------------------------------------------------------
// Website CMS — pages, per-locale block bodies, the UI Blocks registry and
// per-site design tokens. Mounted under /api after the global /api/v1
// requireAuth guard, so every route here is admin-authenticated. The public
// (unauthenticated) read endpoints live in public.ts.
// ---------------------------------------------------------------------------

const router: IRouter = Router();

// ── Sites ──────────────────────────────────────────────────────────────────

router.get("/v1/cms/sites", async (req, res): Promise<void> => {
  // Inactive sites are hidden by default: a development-only instance should
  // not offer a guest/homestay site it does not run. `?all=1` includes them so
  // the site-settings screen can turn one back on.
  const includeInactive = ["1", "true"].includes(String(req.query["all"] ?? ""));
  const rows = await db
    .select()
    .from(cmsSitesTable)
    .where(includeInactive ? undefined : eq(cmsSitesTable.is_active, true))
    .orderBy(asc(cmsSitesTable.sort_order), asc(cmsSitesTable.id));
  res.json(rows);
});

const SiteBody = z.object({
  label: z.string().min(1).optional(),
  host: z.string().nullable().optional(),
  locales: z.array(z.string()).optional(),
  default_locale: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

router.put("/v1/cms/sites/:siteKey", async (req, res): Promise<void> => {
  const parsed = SiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const siteKey = String(req.params["siteKey"]);
  const [before] = await db.select().from(cmsSitesTable).where(eq(cmsSitesTable.site_key, siteKey));
  if (!before) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const patch = { ...parsed.data };
  // Accept a pasted URL but store the bare hostname, so the same value can be
  // handed straight to certificate provisioning below.
  if (typeof patch.host === "string") patch.host = normaliseHostname(patch.host) || null;

  const [row] = await db
    .update(cmsSitesTable)
    .set(patch)
    .where(eq(cmsSitesTable.site_key, siteKey))
    .returning();

  // A custom address is provisioned on the web project automatically, so nobody
  // has to add it in the Vercel dashboard by hand. Not awaited: a provisioning
  // hiccup must not fail the save, and the dialog polls the status endpoint for
  // the outcome.
  if (typeof patch.host !== "undefined" && patch.host !== before.host) {
    void syncSiteDomain(patch.host ?? "", before.host).catch((err) =>
      console.error("[cms] domain sync failed:", err),
    );
  }

  res.json(row);
});

/**
 * Whether this site's address is serving yet — and if not, the exact DNS record
 * still missing, so the admin can show what to add instead of "not working".
 */
router.get("/v1/cms/sites/:siteKey/domain", async (req, res): Promise<void> => {
  const [site] = await db
    .select()
    .from(cmsSitesTable)
    .where(eq(cmsSitesTable.site_key, String(req.params["siteKey"])));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(await getSiteDomainStatus(site.host ?? ""));
});

// ── Block registry ─────────────────────────────────────────────────────────

/**
 * The insert modal's catalog for one site: the code-side specs (field schemas,
 * which the admin form generator needs) merged with any DB overrides. A row
 * with a matching site_key beats the shared default of the same `type`.
 */
router.get("/v1/cms/blocks", async (req, res): Promise<void> => {
  const siteKey = req.query["site"] ? String(req.query["site"]) : null;
  const rows = await db
    .select()
    .from(cmsBlockTemplatesTable)
    .where(and(isNull(cmsBlockTemplatesTable.deleted_at), eq(cmsBlockTemplatesTable.is_active, true)));

  const overrides = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    // Shared defaults first, then let the site-specific row win.
    if (row.site_key === null) {
      if (!overrides.has(row.type)) overrides.set(row.type, row);
    } else if (siteKey && row.site_key === siteKey) {
      overrides.set(row.type, row);
    }
  }

  res.json(
    BLOCK_SPEC_LIST.map((spec) => {
      const override = overrides.get(spec.type);
      return {
        ...spec,
        name: override?.name ?? spec.name,
        description: override?.description ?? spec.description,
        previewImageUrl: override?.preview_image_url ?? null,
        sortOrder: override?.sort_order ?? 0,
        defaultProps:
          override?.default_props && Object.keys(override.default_props as object).length > 0
            ? override.default_props
            : spec.defaultProps,
        templateId: override?.id ?? null,
        isCustom: Boolean(override?.site_key),
      };
    }),
  );
});

const BlockTemplateBody = z.object({
  type: z.string().min(1),
  site_key: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  default_props: z.record(z.string(), z.any()).optional(),
  preview_image_url: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

router.get("/v1/cms/block-templates", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(cmsBlockTemplatesTable)
    .where(isNull(cmsBlockTemplatesTable.deleted_at))
    .orderBy(asc(cmsBlockTemplatesTable.type));
  res.json(rows);
});

router.post("/v1/cms/block-templates", async (req, res): Promise<void> => {
  const parsed = BlockTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const [row] = await db.insert(cmsBlockTemplatesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.put("/v1/cms/block-templates/:id", async (req, res): Promise<void> => {
  const parsed = BlockTemplateBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .update(cmsBlockTemplatesTable)
    .set(parsed.data)
    .where(eq(cmsBlockTemplatesTable.id, Number(req.params["id"])))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/v1/cms/block-templates/:id", async (req, res): Promise<void> => {
  await db
    .update(cmsBlockTemplatesTable)
    .set({ deleted_at: new Date() })
    .where(eq(cmsBlockTemplatesTable.id, Number(req.params["id"])));
  res.json({ success: true });
});

// ── Site settings / design tokens ──────────────────────────────────────────

router.get("/v1/cms/site-settings/:siteKey", async (req, res): Promise<void> => {
  const siteKey = String(req.params["siteKey"]);
  const [row] = await db
    .select()
    .from(cmsSiteSettingsTable)
    .where(eq(cmsSiteSettingsTable.site_key, siteKey));
  if (!row) {
    const [created] = await db
      .insert(cmsSiteSettingsTable)
      .values({ site_key: siteKey })
      .onConflictDoNothing()
      .returning();
    res.json({ ...(created ?? { site_key: siteKey }), design_tokens: resolveTokens(null) });
    return;
  }
  res.json({ ...row, design_tokens: resolveTokens(row.design_tokens) });
});

const SiteSettingsBody = z.object({
  design_tokens: z.record(z.string(), z.any()).optional(),
  nav_header: z.array(z.any()).optional(),
  nav_footer: z.array(z.any()).optional(),
  seo_defaults: z.record(z.string(), z.any()).optional(),
  analytics: z.record(z.string(), z.any()).optional(),
});

router.put("/v1/cms/site-settings/:siteKey", async (req, res): Promise<void> => {
  const parsed = SiteSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const siteKey = String(req.params["siteKey"]);
  const [row] = await db
    .insert(cmsSiteSettingsTable)
    .values({ site_key: siteKey, ...parsed.data })
    .onConflictDoUpdate({ target: cmsSiteSettingsTable.site_key, set: parsed.data })
    .returning();
  res.json(row);
});

// ── Pages ──────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * List pages with a per-locale completion summary. The translation rows are
 * fetched in ONE batched query (inArray) — enriching row-by-row is the N+1
 * pattern that has caused admin list timeouts before.
 */
router.get("/v1/cms/pages", async (req, res): Promise<void> => {
  const conditions: SQL[] = [deletedFilter(cmsPagesTable.deleted_at, req)];
  const site = req.query["site"] ? String(req.query["site"]) : "";
  if (site) conditions.push(eq(cmsPagesTable.site_key, site));
  const status = req.query["status"] ? String(req.query["status"]) : "";
  if (status) conditions.push(eq(cmsPagesTable.status, status));
  const q = req.query["q"] ? String(req.query["q"]).trim() : "";
  if (q) {
    conditions.push(
      or(ilike(cmsPagesTable.title, `%${q}%`), ilike(cmsPagesTable.slug, `%${q}%`))!,
    );
  }

  const pages = await db
    .select()
    .from(cmsPagesTable)
    .where(and(...conditions))
    .orderBy(asc(cmsPagesTable.site_key), asc(cmsPagesTable.sort_order), asc(cmsPagesTable.id));

  if (pages.length === 0) {
    res.json([]);
    return;
  }

  const translations = await db
    .select({
      page_id: cmsPageTranslationsTable.page_id,
      locale: cmsPageTranslationsTable.locale,
      status: cmsPageTranslationsTable.status,
      body_json: cmsPageTranslationsTable.body_json,
      updated_at: cmsPageTranslationsTable.updated_at,
    })
    .from(cmsPageTranslationsTable)
    .where(inArray(cmsPageTranslationsTable.page_id, pages.map((p) => p.id)));

  const byPage = new Map<number, { locale: string; status: string; blocks: number }[]>();
  for (const t of translations) {
    const list = byPage.get(t.page_id) ?? [];
    list.push({
      locale: t.locale,
      status: t.status,
      blocks: countBlocks(normaliseBody(t.body_json).blocks),
    });
    byPage.set(t.page_id, list);
  }

  res.json(pages.map((page) => ({ ...page, locales: byPage.get(page.id) ?? [] })));
});

const PageBody = z.object({
  site_key: z.string().min(1),
  slug: z.string().optional(),
  title: z.string().optional(),
  internal_note: z.string().nullable().optional(),
  legacy_page_key: z.string().nullable().optional(),
  template_key: z.string().nullable().optional(),
  render_mode: z.enum(["legacy", "blocks"]).optional(),
  status: z.string().optional(),
  is_home: z.boolean().optional(),
  nav_hidden: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  seo_keywords: z.string().nullable().optional(),
  seo_image_url: z.string().nullable().optional(),
});

router.post("/v1/cms/pages", async (req, res): Promise<void> => {
  const parsed = PageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  // Slug is derived server-side so two admins can't disagree about it.
  const slug = slugify(parsed.data.slug || parsed.data.title || "page");
  const [existing] = await db
    .select({ id: cmsPagesTable.id })
    .from(cmsPagesTable)
    .where(and(eq(cmsPagesTable.site_key, parsed.data.site_key), eq(cmsPagesTable.slug, slug)));
  if (existing) {
    res.status(409).json({ error: "A page with this address already exists on this site" });
    return;
  }
  const [row] = await db
    .insert(cmsPagesTable)
    .values({ ...parsed.data, slug, render_mode: parsed.data.render_mode ?? "blocks" })
    .returning();
  res.status(201).json(row);
});

router.get("/v1/cms/pages/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [page] = await db.select().from(cmsPagesTable).where(eq(cmsPagesTable.id, id));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  const [site] = await db
    .select()
    .from(cmsSitesTable)
    .where(eq(cmsSitesTable.site_key, page.site_key));
  const translations = await db
    .select({
      locale: cmsPageTranslationsTable.locale,
      status: cmsPageTranslationsTable.status,
      source: cmsPageTranslationsTable.source,
      updated_at: cmsPageTranslationsTable.updated_at,
      body_json: cmsPageTranslationsTable.body_json,
    })
    .from(cmsPageTranslationsTable)
    .where(eq(cmsPageTranslationsTable.page_id, id));
  res.json({
    ...page,
    site: site ?? null,
    locales: translations.map((t) => ({
      locale: t.locale,
      status: t.status,
      source: t.source,
      updated_at: t.updated_at,
      blocks: countBlocks(normaliseBody(t.body_json).blocks),
    })),
  });
});

router.put("/v1/cms/pages/:id", async (req, res): Promise<void> => {
  const parsed = PageBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data };
  if (typeof parsed.data.slug === "string") patch["slug"] = slugify(parsed.data.slug);
  if (parsed.data.status === "Published") patch["published_at"] = new Date();
  const [row] = await db
    .update(cmsPagesTable)
    .set(patch)
    .where(eq(cmsPagesTable.id, Number(req.params["id"])))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  // Only one homepage per site.
  if (row.is_home) {
    await db
      .update(cmsPagesTable)
      .set({ is_home: false })
      .where(and(eq(cmsPagesTable.site_key, row.site_key), isNotNull(cmsPagesTable.id)));
    await db.update(cmsPagesTable).set({ is_home: true }).where(eq(cmsPagesTable.id, row.id));
  }
  res.json(row);
});

const softDeleteCfg = {
  table: cmsPagesTable,
  idColumn: cmsPagesTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Draft",
  onPurge: async (ids: number[]) => {
    await db.delete(cmsPageTranslationsTable).where(inArray(cmsPageTranslationsTable.page_id, ids));
  },
};
router.post("/v1/cms/pages/bulk-delete", makeBulkDelete(softDeleteCfg));
router.post("/v1/cms/pages/bulk-restore", makeBulkRestore(softDeleteCfg));

router.post("/v1/cms/pages/reorder", async (req, res): Promise<void> => {
  const parsed = z
    .object({ order: z.array(z.object({ id: z.number().int(), sort_order: z.number().int() })) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  for (const item of parsed.data.order) {
    await db
      .update(cmsPagesTable)
      .set({ sort_order: item.sort_order })
      .where(eq(cmsPagesTable.id, item.id));
  }
  res.json({ success: true });
});

// ── Page bodies (per locale) ───────────────────────────────────────────────

router.get("/v1/cms/pages/:id/translations/:locale", async (req, res): Promise<void> => {
  const pageId = Number(req.params["id"]);
  const locale = String(req.params["locale"]);
  const [row] = await db
    .select()
    .from(cmsPageTranslationsTable)
    .where(
      and(eq(cmsPageTranslationsTable.page_id, pageId), eq(cmsPageTranslationsTable.locale, locale)),
    );
  if (!row) {
    res.json({ page_id: pageId, locale, body_json: { blocks: [] }, status: "Draft", isNew: true });
    return;
  }
  res.json({ ...row, body_json: normaliseBody(row.body_json) });
});

const TranslationBody = z.object({
  title: z.string().nullable().optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  seo_keywords: z.string().nullable().optional(),
  body_json: z.any().optional(),
  status: z.string().optional(),
  source: z.string().nullable().optional(),
});

router.put("/v1/cms/pages/:id/translations/:locale", async (req, res): Promise<void> => {
  const parsed = TranslationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const pageId = Number(req.params["id"]);
  const locale = String(req.params["locale"]);
  // Normalise (and sanitise HTML) at the boundary — never store client input raw.
  const body = normaliseBody(parsed.data.body_json);
  const values = { ...parsed.data, page_id: pageId, locale, body_json: body };
  const [row] = await db
    .insert(cmsPageTranslationsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [cmsPageTranslationsTable.page_id, cmsPageTranslationsTable.locale],
      set: { ...parsed.data, body_json: body, updated_at: new Date() },
    })
    .returning();
  res.json(row);
});

router.post("/v1/cms/pages/:id/publish", async (req, res): Promise<void> => {
  const pageId = Number(req.params["id"]);
  const locale = req.body?.locale ? String(req.body.locale) : "";
  const status = req.body?.status === "Draft" ? "Draft" : "Published";
  if (locale) {
    await db
      .update(cmsPageTranslationsTable)
      .set({ status })
      .where(
        and(
          eq(cmsPageTranslationsTable.page_id, pageId),
          eq(cmsPageTranslationsTable.locale, locale),
        ),
      );
  } else {
    await db.update(cmsPageTranslationsTable).set({ status }).where(eq(cmsPageTranslationsTable.page_id, pageId));
  }
  const [page] = await db
    .update(cmsPagesTable)
    .set({ status, published_at: status === "Published" ? new Date() : null })
    .where(eq(cmsPagesTable.id, pageId))
    .returning();
  res.json(page);
});

// ── AI translation ─────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Simplified Chinese",
  th: "Thai",
  vi: "Vietnamese",
};

/**
 * Clone the base locale's block tree and translate only its text-bearing props.
 * Structure, ids, images, links and styling are copied verbatim — the model
 * never sees or rewrites them.
 */
async function translateRefs(refs: TextRef[], from: string, to: string): Promise<TextRef[]> {
  if (refs.length === 0) return [];
  const anthropic = getAnthropic();
  const payload = refs.map((r, i) => ({ i, text: r.value }));
  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 8000,
    system:
      `You translate website copy from ${LANG_NAMES[from] ?? from} to ${LANG_NAMES[to] ?? to}. ` +
      "Return ONLY a JSON array of objects {\"i\": number, \"text\": string} with the same indices. " +
      "Preserve any HTML tags, placeholders and line breaks exactly. Translate marketing copy naturally " +
      "for a native reader; do not add or remove information.",
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const text = response.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("Translation response was not JSON");
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { i: number; text: string }[];
  return parsed
    .filter((p) => refs[p.i])
    .map((p) => ({ path: refs[p.i]!.path, value: String(p.text ?? "") }));
}

router.post("/v1/cms/pages/:id/translate", async (req, res): Promise<void> => {
  if (!isChatConfigured()) {
    res.status(503).json({ error: "AI translation is not configured (ANTHROPIC_API_KEY missing)" });
    return;
  }
  const parsed = z
    .object({ from: z.string().min(2), to: z.array(z.string().min(2)).min(1) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const pageId = Number(req.params["id"]);
  const { from, to } = parsed.data;

  const [base] = await db
    .select()
    .from(cmsPageTranslationsTable)
    .where(
      and(eq(cmsPageTranslationsTable.page_id, pageId), eq(cmsPageTranslationsTable.locale, from)),
    );
  if (!base) {
    res.status(404).json({ error: `No ${from} version to translate from` });
    return;
  }
  const baseBlocks: Block[] = normaliseBody(base.body_json).blocks;
  const refs = collectTextRefs(baseBlocks);

  const results: { locale: string; ok: boolean; error?: string }[] = [];
  for (const locale of to) {
    if (locale === from) continue;
    try {
      const translated = await translateRefs(refs, from, locale);
      const blocks = applyTextRefs(baseBlocks, translated);
      const values = {
        page_id: pageId,
        locale,
        title: base.title,
        seo_title: base.seo_title,
        seo_description: base.seo_description,
        body_json: { blocks },
        status: "Draft",
        source: "machine",
        translated_at: new Date(),
      };
      await db
        .insert(cmsPageTranslationsTable)
        .values(values)
        .onConflictDoUpdate({
          target: [cmsPageTranslationsTable.page_id, cmsPageTranslationsTable.locale],
          set: { body_json: values.body_json, source: "machine", translated_at: new Date(), updated_at: new Date() },
        });
      results.push({ locale, ok: true });
    } catch (err) {
      const message = err instanceof ChatConfigError ? err.message : err instanceof Error ? err.message : "failed";
      console.error(`[cms/translate] ${locale} failed:`, message);
      results.push({ locale, ok: false, error: message });
    }
  }
  res.json({ results });
});

// ── Blog post bodies (per locale) — same shape as pages ────────────────────

router.get("/v1/cms/posts/:id/translations/:locale", async (req, res): Promise<void> => {
  const postId = Number(req.params["id"]);
  const locale = String(req.params["locale"]);
  const [row] = await db
    .select()
    .from(cmsPostTranslationsTable)
    .where(
      and(eq(cmsPostTranslationsTable.post_id, postId), eq(cmsPostTranslationsTable.locale, locale)),
    );
  if (!row) {
    res.json({ post_id: postId, locale, body_json: { blocks: [] }, status: "Draft", isNew: true });
    return;
  }
  res.json({ ...row, body_json: normaliseBody(row.body_json) });
});

router.put("/v1/cms/posts/:id/translations/:locale", async (req, res): Promise<void> => {
  const parsed = TranslationBody.extend({ excerpt: z.string().nullable().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const postId = Number(req.params["id"]);
  const locale = String(req.params["locale"]);
  const body = normaliseBody(parsed.data.body_json);
  const [row] = await db
    .insert(cmsPostTranslationsTable)
    .values({ ...parsed.data, post_id: postId, locale, body_json: body })
    .onConflictDoUpdate({
      target: [cmsPostTranslationsTable.post_id, cmsPostTranslationsTable.locale],
      set: { ...parsed.data, body_json: body, updated_at: new Date() },
    })
    .returning();
  res.json(row);
});

router.post("/v1/cms/posts/:id/translate", async (req, res): Promise<void> => {
  if (!isChatConfigured()) {
    res.status(503).json({ error: "AI translation is not configured (ANTHROPIC_API_KEY missing)" });
    return;
  }
  const parsed = z
    .object({ from: z.string().min(2), to: z.array(z.string().min(2)).min(1) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const postId = Number(req.params["id"]);
  const { from, to } = parsed.data;
  const [base] = await db
    .select()
    .from(cmsPostTranslationsTable)
    .where(
      and(eq(cmsPostTranslationsTable.post_id, postId), eq(cmsPostTranslationsTable.locale, from)),
    );
  if (!base) {
    res.status(404).json({ error: `No ${from} version to translate from` });
    return;
  }
  const baseBlocks = normaliseBody(base.body_json).blocks;
  const refs = collectTextRefs(baseBlocks);
  const results: { locale: string; ok: boolean; error?: string }[] = [];
  for (const locale of to) {
    if (locale === from) continue;
    try {
      const translated = await translateRefs(refs, from, locale);
      const [titleRef] = base.title ? await translateRefs([{ path: "t", value: base.title }], from, locale) : [];
      await db
        .insert(cmsPostTranslationsTable)
        .values({
          post_id: postId,
          locale,
          title: titleRef?.value ?? base.title,
          excerpt: base.excerpt,
          body_json: { blocks: applyTextRefs(baseBlocks, translated) },
          status: "Draft",
          source: "machine",
          translated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [cmsPostTranslationsTable.post_id, cmsPostTranslationsTable.locale],
          set: {
            title: titleRef?.value ?? base.title,
            body_json: { blocks: applyTextRefs(baseBlocks, translated) },
            source: "machine",
            translated_at: new Date(),
            updated_at: new Date(),
          },
        });
      results.push({ locale, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed";
      console.error(`[cms/posts/translate] ${locale} failed:`, message);
      results.push({ locale, ok: false, error: message });
    }
  }
  res.json({ results });
});

// ── Legacy import ──────────────────────────────────────────────────────────

/**
 * Fold a legacy `page_contents` row into a starting block tree so an editor
 * never begins from a blank canvas when converting an existing page. The field
 * groups the old fixed-field editor used (hero_*, feature_N_*, stat_*, cta_*)
 * map onto blocks; anything unmatched is preserved in a rich-text block so no
 * copy is lost.
 */
router.post("/v1/cms/pages/:id/import-legacy", async (req, res): Promise<void> => {
  const pageId = Number(req.params["id"]);
  const locale = String(req.body?.locale ?? "en");
  const [page] = await db.select().from(cmsPagesTable).where(eq(cmsPagesTable.id, pageId));
  if (!page?.legacy_page_key) {
    res.status(400).json({ error: "This page has no legacy page key" });
    return;
  }
  const [legacy] = await db
    .select()
    .from(pageContentsTable)
    .where(
      and(
        eq(pageContentsTable.page_key, page.legacy_page_key),
        eq(pageContentsTable.language, locale),
      ),
    );
  if (!legacy) {
    res.status(404).json({ error: `No legacy content for ${page.legacy_page_key}/${locale}` });
    return;
  }

  const content = (legacy.content ?? {}) as Record<string, string>;
  const used = new Set<string>();
  const take = (key: string): string => {
    const value = content[key];
    if (typeof value === "string" && value.trim()) {
      used.add(key);
      return value;
    }
    if (value !== undefined) used.add(key);
    return "";
  };
  const blocks: Block[] = [];
  const id = (n: number) => `legacy_${n}`;
  let seq = 0;

  const heroTitle = take("hero_title");
  if (heroTitle || content["hero_subtitle"]) {
    blocks.push({
      id: id(seq++),
      type: "hero-banner",
      props: {
        title: heroTitle,
        subtitle: take("hero_subtitle"),
        description: take("hero_description"),
        buttonLabel: take("hero_cta_primary") || take("cta_primary"),
        secondaryLabel: take("hero_cta_secondary") || take("cta_secondary"),
        backgroundImage: { url: take("hero_image_url") },
        overlay: true,
      },
      style: { bg: "ink", width: "full", spacingTop: 0, spacingBottom: 0, align: "center" },
    });
  }

  const features: Record<string, unknown>[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const title = take(`feature_${i}_title`);
    const description = take(`feature_${i}_body`);
    if (title || description) features.push({ title, description });
  }
  if (features.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "feature-list",
      props: { title: take("why_title"), subtitle: take("why_body"), columns: "3", items: features },
      style: { spacingTop: 3, spacingBottom: 3, width: "contained" },
    });
  }

  const stats = Object.keys(content)
    .filter((k) => k.startsWith("stat_"))
    .map((k) => {
      used.add(k);
      return { value: String(content[k] ?? ""), label: k.replace("stat_", "").replace(/_/g, " ") };
    });
  if (stats.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "statistics",
      props: { title: "", items: stats },
      style: { bg: "surface", spacingTop: 3, spacingBottom: 3 },
    });
  }

  const ctaTitle = take("cta_title");
  if (ctaTitle) {
    blocks.push({
      id: id(seq++),
      type: "cta-banner",
      props: { title: ctaTitle, subtitle: take("cta_subtitle"), buttonLabel: take("cta_button"), buttonUrl: "" },
      style: { bg: "primary", spacingTop: 3, spacingBottom: 3, align: "center", width: "full" },
    });
  }

  // Nothing is discarded — leftovers become a rich-text block for the editor.
  const leftovers = Object.entries(content).filter(
    ([k, v]) => !used.has(k) && typeof v === "string" && v.trim(),
  );
  if (leftovers.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "rich-text",
      props: {
        title: "",
        body: leftovers.map(([k, v]) => `<p><strong>${k}</strong><br>${v}</p>`).join("\n"),
      },
      style: { spacingTop: 2, spacingBottom: 2, width: "contained" },
    });
  }

  const body = normaliseBody({ blocks });
  await db
    .insert(cmsPageTranslationsTable)
    .values({
      page_id: pageId,
      locale,
      title: page.title,
      seo_title: legacy.seo_title,
      seo_description: legacy.seo_description,
      seo_keywords: legacy.seo_keywords,
      body_json: body,
      status: "Draft",
      source: "human",
    })
    .onConflictDoUpdate({
      target: [cmsPageTranslationsTable.page_id, cmsPageTranslationsTable.locale],
      set: { body_json: body, updated_at: new Date() },
    });
  res.json({ success: true, blocks: body.blocks.length, unmatchedKeys: leftovers.map(([k]) => k) });
});

// ── Blog helper: list posts for the admin, scoped by site ──────────────────

router.get("/v1/cms/posts", async (req, res): Promise<void> => {
  const conditions: SQL[] = [deletedFilter(blogPostsTable.deleted_at, req)];
  const site = req.query["site"] ? String(req.query["site"]) : "";
  if (site) conditions.push(eq(blogPostsTable.site_key, site));
  const rows = await db
    .select()
    .from(blogPostsTable)
    .where(and(...conditions))
    .orderBy(desc(blogPostsTable.published_at), desc(blogPostsTable.id));
  res.json(rows);
});

export default router;
