-- 0090 — SEO / GEO optimisation layer
--
-- Adds the metadata an answer engine needs to quote a page (a self-contained
-- summary + FAQ pairs + explicit JSON-LD), the per-locale social/OG overrides
-- search engines and messengers read, and an append-only audit history so the
-- admin can show whether a page improved or regressed.
--
-- Additive and idempotent: every statement is IF NOT EXISTS. Nothing is
-- rewritten, nothing is dropped, and no existing row changes value.

-- ── Base rows: page / blog / listing ───────────────────────────────────────
ALTER TABLE cms_pages     ADD COLUMN IF NOT EXISTS canonical_url      text;
ALTER TABLE cms_pages     ADD COLUMN IF NOT EXISTS robots_directives  text;
ALTER TABLE cms_pages     ADD COLUMN IF NOT EXISTS json_ld            jsonb;
ALTER TABLE cms_pages     ADD COLUMN IF NOT EXISTS geo_answer_summary text;
ALTER TABLE cms_pages     ADD COLUMN IF NOT EXISTS geo_faq            jsonb;

ALTER TABLE blog_posts    ADD COLUMN IF NOT EXISTS canonical_url      text;
ALTER TABLE blog_posts    ADD COLUMN IF NOT EXISTS robots_directives  text;
ALTER TABLE blog_posts    ADD COLUMN IF NOT EXISTS json_ld            jsonb;
ALTER TABLE blog_posts    ADD COLUMN IF NOT EXISTS geo_answer_summary text;
ALTER TABLE blog_posts    ADD COLUMN IF NOT EXISTS geo_faq            jsonb;

ALTER TABLE sale_listings ADD COLUMN IF NOT EXISTS canonical_url      text;
ALTER TABLE sale_listings ADD COLUMN IF NOT EXISTS robots_directives  text;
ALTER TABLE sale_listings ADD COLUMN IF NOT EXISTS json_ld            jsonb;
ALTER TABLE sale_listings ADD COLUMN IF NOT EXISTS geo_answer_summary text;
ALTER TABLE sale_listings ADD COLUMN IF NOT EXISTS geo_faq            jsonb;

-- ── Per-locale overrides ───────────────────────────────────────────────────
ALTER TABLE cms_page_translations ADD COLUMN IF NOT EXISTS og_title           text;
ALTER TABLE cms_page_translations ADD COLUMN IF NOT EXISTS og_description     text;
ALTER TABLE cms_page_translations ADD COLUMN IF NOT EXISTS seo_image_url      text;
ALTER TABLE cms_page_translations ADD COLUMN IF NOT EXISTS geo_answer_summary text;
ALTER TABLE cms_page_translations ADD COLUMN IF NOT EXISTS json_ld            jsonb;

ALTER TABLE cms_post_translations ADD COLUMN IF NOT EXISTS og_title           text;
ALTER TABLE cms_post_translations ADD COLUMN IF NOT EXISTS og_description     text;
ALTER TABLE cms_post_translations ADD COLUMN IF NOT EXISTS seo_image_url      text;
ALTER TABLE cms_post_translations ADD COLUMN IF NOT EXISTS geo_answer_summary text;
ALTER TABLE cms_post_translations ADD COLUMN IF NOT EXISTS json_ld            jsonb;

-- ── Audit history ──────────────────────────────────────────────────────────
-- One row per (site, entity, locale, version). Append-only: an audit never
-- edits live SEO, it records what the metadata scored at that moment.
CREATE TABLE IF NOT EXISTS seo_audits (
  id             serial PRIMARY KEY,
  site_key       text NOT NULL,
  entity_type    text NOT NULL,
  entity_id      integer NOT NULL,
  locale         text NOT NULL,
  version        integer NOT NULL,
  score_total    integer NOT NULL,
  scores_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  gaps_json      jsonb NOT NULL DEFAULT '[]'::jsonb,
  drift_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source         text NOT NULL DEFAULT 'manual',
  audited_by     text,
  audited_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seo_audits_entity_version_unique
  ON seo_audits (site_key, entity_type, entity_id, locale, version);
CREATE INDEX IF NOT EXISTS seo_audits_site_idx
  ON seo_audits (site_key, entity_type, entity_id);

-- `cms_site_settings.seo_defaults` already exists (0037) and needs no change;
-- this feature is what finally reads it.
