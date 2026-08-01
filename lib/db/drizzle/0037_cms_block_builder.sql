-- 0037 — Website CMS: block-based, multi-site, multilingual page builder.
--
-- Additive. Creates the CMS tables, extends the blog with a site key + block
-- body, and seeds the three sites (www / homestay / dev) plus the system block
-- template registry. Safe to re-run (IF NOT EXISTS / ON CONFLICT throughout).

-- ── Site registry ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_sites (
  id             serial PRIMARY KEY,
  site_key       text NOT NULL UNIQUE,
  label          text NOT NULL,
  host           text,
  locales        jsonb NOT NULL DEFAULT '["en"]'::jsonb,
  default_locale text NOT NULL DEFAULT 'en',
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Pages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_pages (
  id              serial PRIMARY KEY,
  site_key        text NOT NULL,
  slug            text NOT NULL,
  legacy_page_key text,
  title           text,
  template_key    text,
  render_mode     text NOT NULL DEFAULT 'legacy',
  status          text NOT NULL DEFAULT 'Draft',
  is_home         boolean NOT NULL DEFAULT false,
  nav_hidden      boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  seo_image_url   text,
  published_at    timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_pages_site_slug_unique UNIQUE (site_key, slug)
);
CREATE INDEX IF NOT EXISTS cms_pages_site_status_idx ON cms_pages (site_key, status);
CREATE INDEX IF NOT EXISTS cms_pages_legacy_key_idx ON cms_pages (legacy_page_key);

CREATE TABLE IF NOT EXISTS cms_page_translations (
  id              serial PRIMARY KEY,
  page_id         integer NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale          text NOT NULL,
  title           text,
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  body_json       jsonb NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
  status          text NOT NULL DEFAULT 'Draft',
  source          text,
  translated_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_page_translations_page_locale_unique UNIQUE (page_id, locale)
);

-- ── Blog block bodies ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_post_translations (
  id              serial PRIMARY KEY,
  post_id         integer NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  locale          text NOT NULL,
  title           text,
  excerpt         text,
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  body_json       jsonb NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
  status          text NOT NULL DEFAULT 'Draft',
  source          text,
  translated_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_post_translations_post_locale_unique UNIQUE (post_id, locale)
);

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS site_key text NOT NULL DEFAULT 'www';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS render_mode text NOT NULL DEFAULT 'legacy';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS body_json jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_alt text;
CREATE INDEX IF NOT EXISTS blog_posts_site_status_idx ON blog_posts (site_key, status);

ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS site_key text NOT NULL DEFAULT 'www';
-- Category names are unique per site, not globally.
ALTER TABLE blog_categories DROP CONSTRAINT IF EXISTS blog_categories_name_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_categories_name_site_unique'
  ) THEN
    ALTER TABLE blog_categories
      ADD CONSTRAINT blog_categories_name_site_unique UNIQUE (name, site_key);
  END IF;
END $$;

-- Historical homestay posts were separated by category, not by site. Move them
-- onto the homestay blog so the new per-site split matches what was published.
UPDATE blog_posts SET site_key = 'homestay' WHERE lower(coalesce(category, '')) = 'homestay';
UPDATE blog_categories SET site_key = 'homestay' WHERE lower(name) = 'homestay';

-- ── UI Blocks registry ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_block_templates (
  id                serial PRIMARY KEY,
  type              text NOT NULL,
  site_key          text,
  name              text NOT NULL,
  description       text,
  category          text NOT NULL DEFAULT 'Content',
  default_props     jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_image_url text,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_block_templates_type_site_unique UNIQUE (type, site_key)
);

-- ── Per-site settings / design tokens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_site_settings (
  id            serial PRIMARY KEY,
  site_key      text NOT NULL UNIQUE,
  design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  nav_header    jsonb NOT NULL DEFAULT '[]'::jsonb,
  nav_footer    jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_defaults  jsonb NOT NULL DEFAULT '{}'::jsonb,
  analytics     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Media index (Cloudinary still owns the bytes) ──────────────────────────
CREATE TABLE IF NOT EXISTS cms_media_folders (
  id         serial PRIMARY KEY,
  parent_id  integer REFERENCES cms_media_folders(id) ON DELETE SET NULL,
  name       text NOT NULL,
  path       text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cms_media_assets (
  id          serial PRIMARY KEY,
  public_id   text NOT NULL UNIQUE,
  url         text NOT NULL,
  folder      text NOT NULL DEFAULT 'content',
  format      text,
  width       integer,
  height      integer,
  bytes       integer,
  alt_text    text,
  tags        jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by integer,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cms_media_assets_folder_idx ON cms_media_assets (folder);

-- ── Seed: sites ────────────────────────────────────────────────────────────
INSERT INTO cms_sites (site_key, label, host, locales, default_locale, sort_order)
VALUES
  ('www',      'Guest site',   'https://millionstay.com.au',
   '["en","ko","ja","th","vi","zh"]'::jsonb, 'en', 1),
  ('homestay', 'Homestay',     'https://homestay.millionstay.com',
   '["en","ja","ko","th","zh"]'::jsonb,      'en', 2),
  ('dev',      'Development',  '',
   '["ko","en","ja","th","vi","zh"]'::jsonb, 'ko', 3)
ON CONFLICT (site_key) DO NOTHING;

INSERT INTO cms_site_settings (site_key) VALUES ('www'), ('homestay'), ('dev')
ON CONFLICT (site_key) DO NOTHING;
