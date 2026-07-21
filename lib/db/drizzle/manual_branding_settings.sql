-- Branding settings — a single global row holding the runtime, admin-editable
-- brand identity (colours, logo/favicon URLs, custom CSS, display prefs) behind
-- the property-admin "Design & Branding" page. Defaults = MillionStay palette.
-- Idempotent / additive — safe to re-run.

CREATE TABLE IF NOT EXISTS "branding_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "brand_name" text,
  "primary_color" text DEFAULT '#E8621A' NOT NULL,
  "secondary_color" text DEFAULT '#16263F' NOT NULL,
  "accent_color" text DEFAULT '#FAF5EC' NOT NULL,
  "sidebar_theme" text DEFAULT 'dark' NOT NULL,
  "logo_url" text,
  "logo_dark_url" text,
  "favicon_url" text,
  "favicon_dark_url" text,
  "custom_css" text,
  "dark_mode" boolean DEFAULT false NOT NULL,
  "date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL,
  "currency" text DEFAULT 'AUD' NOT NULL,
  "currency_position" text DEFAULT 'prefix' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
