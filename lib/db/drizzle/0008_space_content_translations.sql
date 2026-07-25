-- Additive: per-locale content translations for guest-facing entities.
-- Admins author the original (usually Korean) in the existing name/description
-- columns; these jsonb columns hold AI-generated + human-reviewed translations
-- keyed by language code, e.g.
--   { "en": { "name": "...", "description": "...", "_source": "human" }, "ja": {...} }
-- The public API resolves a single language per request with fallback [lang, ko, en].
-- Applied directly to prod via psql (drizzle journal baseline restoration still
-- pending, so this DDL is not wired into meta/_journal). Additive-only.
ALTER TABLE "spaces"        ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "properties"    ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "space_options" ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb;
