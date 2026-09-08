import { pgTable, serial, text, integer, timestamp, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * SEO / GEO audit history — one row per (entity × locale × version).
 *
 * An audit NEVER changes live SEO. It is a scored snapshot of the metadata an
 * entity already carries, appended as a new version, so staff can see whether a
 * page got better or worse over time and what regressed. AI drafts produced
 * alongside an audit land in `generated_json` and stay there until a human
 * approves them, at which point they are written to the entity's own columns.
 *
 * See docs/SEO_GEO_OPTIMISATION.md.
 */
export const seoAuditsTable = pgTable(
  "seo_audits",
  {
    id: serial("id").primaryKey(),
    /** cms_sites.site_key — the site this entity was audited under. */
    site_key: text("site_key").notNull(),
    /** 'page' (cms_pages) | 'blog' (blog_posts) | 'listing' (sale_listings). */
    entity_type: text("entity_type").notNull(),
    entity_id: integer("entity_id").notNull(),
    locale: text("locale").notNull(),
    /** Monotonic per (site, entity, locale). v1 is the first audit. */
    version: integer("version").notNull(),
    score_total: integer("score_total").notNull(),
    /** { meta: { score, max }, … } for the eight categories. */
    scores_json: jsonb("scores_json").notNull().default({}),
    /** [{ code, label, severity, category }] sorted by severity. */
    gaps_json: jsonb("gaps_json").notNull().default([]),
    /** { scoreDelta, added[], resolved[] } against the previous version. */
    drift_json: jsonb("drift_json").notNull().default({}),
    /** AI drafts awaiting human approval — never live copy. */
    generated_json: jsonb("generated_json").notNull().default({}),
    /** 'manual' = someone pressed refresh; 'scheduled' = the nightly cron. */
    source: text("source").notNull().default("manual"),
    audited_by: text("audited_by"),
    audited_at: timestamp("audited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("seo_audits_entity_version_unique").on(
      t.site_key,
      t.entity_type,
      t.entity_id,
      t.locale,
      t.version,
    ),
    index("seo_audits_site_idx").on(t.site_key, t.entity_type, t.entity_id),
  ],
);

export const insertSeoAuditSchema = createInsertSchema(seoAuditsTable).omit({
  id: true,
  audited_at: true,
});
export type InsertSeoAudit = z.infer<typeof insertSeoAuditSchema>;
export type SeoAudit = typeof seoAuditsTable.$inferSelect;
