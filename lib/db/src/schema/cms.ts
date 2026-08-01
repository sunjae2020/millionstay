import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Website CMS — block-based, multi-site, multilingual page builder.
//
// This replaces the "one fixed field list per page" model of `page_contents`
// with a block tree (`body_json.blocks[]`) stored per (page, locale).
//
// Instance separation (white-label) happens at the DEPLOYMENT level here (each
// instance has its own DB), so there is no organisation scoping. The axis that
// DOES split content inside one instance is the SITE: the guest site (www), the
// homestay site, and the Metheim development site each get their own pages,
// blog, navigation and design tokens — keyed by `site_key`.
//
// `cms_pages.render_mode` is the migration safety valve: 'legacy' pages keep
// rendering from the hardcoded React sections + `page_contents` overlay, and
// only pages flipped to 'blocks' are drawn by the block renderer. Pages move
// over one at a time.
// ---------------------------------------------------------------------------

/** Site registry — replaces the hardcoded SITES/PAGES constants in the admin. */
export const cmsSitesTable = pgTable("cms_sites", {
  id: serial("id").primaryKey(),
  /** 'www' | 'homestay' | 'dev' — stable key referenced by every other table. */
  site_key: text("site_key").notNull().unique(),
  label: text("label").notNull(),
  /** Preview / canonical URL base, e.g. https://homestay.millionstay.com */
  host: text("host"),
  /** Locale codes this site publishes, in display order. */
  locales: jsonb("locales").notNull().default(["en"]),
  default_locale: text("default_locale").notNull().default("en"),
  is_active: boolean("is_active").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** One row per page. Locale-specific body lives in cms_page_translations. */
export const cmsPagesTable = pgTable(
  "cms_pages",
  {
    id: serial("id").primaryKey(),
    site_key: text("site_key").notNull(),
    /** '' or 'home' = the site homepage. */
    slug: text("slug").notNull(),
    /** Matching `page_contents.page_key`, kept so the legacy overlay still resolves. */
    legacy_page_key: text("legacy_page_key"),
    title: text("title"),
    template_key: text("template_key"),
    /** 'legacy' = hardcoded React sections; 'blocks' = rendered from body_json. */
    render_mode: text("render_mode").notNull().default("legacy"),
    status: text("status").notNull().default("Draft"),
    is_home: boolean("is_home").notNull().default(false),
    nav_hidden: boolean("nav_hidden").notNull().default(false),
    sort_order: integer("sort_order").notNull().default(0),
    seo_title: text("seo_title"),
    seo_description: text("seo_description"),
    seo_keywords: text("seo_keywords"),
    seo_image_url: text("seo_image_url"),
    published_at: timestamp("published_at", { withTimezone: true }),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("cms_pages_site_slug_unique").on(t.site_key, t.slug)],
);

/**
 * (page × locale) — the per-language page version the editor works on
 * ("You are editing English version"). Mirrors document_template_translations.
 */
export const cmsPageTranslationsTable = pgTable(
  "cms_page_translations",
  {
    id: serial("id").primaryKey(),
    page_id: integer("page_id").notNull(),
    locale: text("locale").notNull(),
    title: text("title"),
    seo_title: text("seo_title"),
    seo_description: text("seo_description"),
    seo_keywords: text("seo_keywords"),
    /** { blocks: Block[] } — the page builder tree. */
    body_json: jsonb("body_json").notNull().default({ blocks: [] }),
    status: text("status").notNull().default("Draft"),
    /** 'human' | 'machine' — AI-drafted copy is flagged until a human reviews it. */
    source: text("source"),
    translated_at: timestamp("translated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("cms_page_translations_page_locale_unique").on(t.page_id, t.locale)],
);

/** (post × locale) — same shape as cms_page_translations, for blog bodies. */
export const cmsPostTranslationsTable = pgTable(
  "cms_post_translations",
  {
    id: serial("id").primaryKey(),
    post_id: integer("post_id").notNull(),
    locale: text("locale").notNull(),
    title: text("title"),
    excerpt: text("excerpt"),
    seo_title: text("seo_title"),
    seo_description: text("seo_description"),
    seo_keywords: text("seo_keywords"),
    body_json: jsonb("body_json").notNull().default({ blocks: [] }),
    status: text("status").notNull().default("Draft"),
    source: text("source"),
    translated_at: timestamp("translated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("cms_post_translations_post_locale_unique").on(t.post_id, t.locale)],
);

/**
 * The "UI Blocks" registry — what the insert modal offers and what staff can
 * customise. site_key NULL = shared system default; a row with a site_key
 * overrides the default of the same `type` for that site only.
 */
export const cmsBlockTemplatesTable = pgTable(
  "cms_block_templates",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    site_key: text("site_key"),
    name: text("name").notNull(),
    description: text("description"),
    /** Layout | Content | Media | Marketing | Form | Data */
    category: text("category").notNull().default("Content"),
    /** Seed props applied when the block is inserted. */
    default_props: jsonb("default_props").notNull().default({}),
    preview_image_url: text("preview_image_url"),
    is_active: boolean("is_active").notNull().default(true),
    sort_order: integer("sort_order").notNull().default(0),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("cms_block_templates_type_site_unique").on(t.type, t.site_key)],
);

/**
 * Per-site design tokens + navigation + SEO defaults. Admins manage these per
 * site_key themselves (no central design approver). Block styles reference the
 * token ROLES defined here, never raw hex/px — that is the visual guardrail.
 *
 * Runtime brand identity for the ADMIN app stays in `branding_settings`; this
 * row is the public site's rendering palette.
 */
export const cmsSiteSettingsTable = pgTable("cms_site_settings", {
  id: serial("id").primaryKey(),
  site_key: text("site_key").notNull().unique(),
  design_tokens: jsonb("design_tokens").notNull().default({}),
  nav_header: jsonb("nav_header").notNull().default([]),
  nav_footer: jsonb("nav_footer").notNull().default([]),
  seo_defaults: jsonb("seo_defaults").notNull().default({}),
  analytics: jsonb("analytics").notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Media index. Cloudinary still owns the bytes; these rows exist so the media
 * centre can search, tag, caption (alt text) and organise assets into folders.
 */
export const cmsMediaFoldersTable = pgTable("cms_media_folders", {
  id: serial("id").primaryKey(),
  parent_id: integer("parent_id"),
  name: text("name").notNull(),
  /** Full Cloudinary-relative path, e.g. "content/homestay/hero". */
  path: text("path").notNull().unique(),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cmsMediaAssetsTable = pgTable("cms_media_assets", {
  id: serial("id").primaryKey(),
  public_id: text("public_id").notNull().unique(),
  url: text("url").notNull(),
  folder: text("folder").notNull().default("content"),
  format: text("format"),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes"),
  alt_text: text("alt_text"),
  tags: jsonb("tags").notNull().default([]),
  uploaded_by: integer("uploaded_by"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCmsPageSchema = createInsertSchema(cmsPagesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const insertCmsSiteSchema = createInsertSchema(cmsSitesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const insertCmsBlockTemplateSchema = createInsertSchema(cmsBlockTemplatesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;
export type CmsSite = typeof cmsSitesTable.$inferSelect;
export type CmsPage = typeof cmsPagesTable.$inferSelect;
export type CmsPageTranslation = typeof cmsPageTranslationsTable.$inferSelect;
export type CmsPostTranslation = typeof cmsPostTranslationsTable.$inferSelect;
export type CmsBlockTemplate = typeof cmsBlockTemplatesTable.$inferSelect;
export type CmsSiteSettings = typeof cmsSiteSettingsTable.$inferSelect;
export type CmsMediaAsset = typeof cmsMediaAssetsTable.$inferSelect;
export type CmsMediaFolder = typeof cmsMediaFoldersTable.$inferSelect;
