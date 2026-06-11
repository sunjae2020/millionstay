-- Owner landing sites — one independent public landing page per owner account,
-- served at "{slug}.millionstay.com". Managed from owner-portal → "내 사이트".
-- Idempotent / additive — safe to re-run.

CREATE TABLE IF NOT EXISTS "owner_sites" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "slug" text NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "logo_url" text,
  "primary_color" text DEFAULT '#0ea5e9' NOT NULL,
  "hero_image_url" text,
  "content" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "seo_title" text,
  "seo_description" text,
  "og_image_url" text,
  "custom_domain" text,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "owner_sites_account_id_unique" UNIQUE("account_id"),
  CONSTRAINT "owner_sites_slug_unique" UNIQUE("slug")
);

-- Fast subdomain → site lookup on every public landing request.
CREATE INDEX IF NOT EXISTS "owner_sites_slug_idx" ON "owner_sites" ("slug");

-- Owner-scoping for leads captured from an owner landing site's inquiry form,
-- so owners can see only their own inquiries in the owner portal.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "owner_account_id" integer;
CREATE INDEX IF NOT EXISTS "leads_owner_account_idx" ON "leads" ("owner_account_id");
