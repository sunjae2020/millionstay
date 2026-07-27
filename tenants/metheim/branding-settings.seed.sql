-- =============================================================================
-- tenants/metheim/branding-settings.seed.sql
-- Metheim admin brand kit — seeds the single `branding_settings` row (id=1) that
-- backs the property-admin "Design & Branding" page at RUNTIME. Build-time
-- defaults live in @workspace/design-tokens/brand.css + tenants/metheim/config.env
-- (BRAND_*); this row overrides them live for everyone on the instance.
--
-- Source of truth: tenants/metheim/brand-guidelines.md v1.0.
--
-- Apply to the Metheim instance DB ONLY (Supabase project: metheim /
-- dhdjxweuushugqltjael) — NEVER the primary MillionStay DB:
--   psql "$METHEIM_DATABASE_URL" -f tenants/metheim/branding-settings.seed.sql
-- (`pnpm db:push` hangs on the interactive _seed_meta prompt — use psql.)
--
-- Idempotent: upserts the singleton (id=1). Re-running preserves any admin edit
-- to logo_dark_url / favicon_dark_url / custom_css (those are not overwritten).
-- =============================================================================

INSERT INTO branding_settings (
  id, brand_name,
  primary_color, secondary_color, accent_color, sidebar_theme,
  logo_url, logo_dark_url, favicon_url,
  dark_mode, date_format, currency, currency_position
) VALUES (
  1, 'Metheim',
  '#005F73',    -- Urban Teal  · primary
  '#00323D',    -- Deep Teal   · secondary / dark heading
  '#F4EFE1',    -- Cream       · warm light accent
  'dark',       -- deep-teal sidebar (guideline §12)
  'https://res.cloudinary.com/dthc3gmdr/image/upload/v1784456084/metheim/logos/metheim-logo-horizontal-teal.svg',
  'https://res.cloudinary.com/dthc3gmdr/image/upload/v1784456084/metheim/logos/metheim-logo-horizontal-white.svg',
                -- logo_dark_url: all-white reverse lockup for the deep-teal sidebar / dark surfaces
  'https://res.cloudinary.com/dthc3gmdr/image/upload/v1784456074/metheim/logos/favicon.svg',
  false,        -- dark_mode
  'YYYY-MM-DD', -- KR date format (guideline tables use YYYY-MM-DD)
  'KRW',        -- Korean won
  'prefix'      -- ₩ prefix
)
ON CONFLICT (id) DO UPDATE SET
  brand_name        = EXCLUDED.brand_name,
  primary_color     = EXCLUDED.primary_color,
  secondary_color   = EXCLUDED.secondary_color,
  accent_color      = EXCLUDED.accent_color,
  sidebar_theme     = EXCLUDED.sidebar_theme,
  logo_url          = EXCLUDED.logo_url,
  favicon_url       = EXCLUDED.favicon_url,
  dark_mode         = EXCLUDED.dark_mode,
  date_format       = EXCLUDED.date_format,
  currency          = EXCLUDED.currency,
  currency_position = EXCLUDED.currency_position,
  updated_at        = now();
