-- Additive: 분양/판매 property listings board for the development ("Metheim") site.
-- Applied directly to prod via psql (the drizzle journal baseline restoration is
-- still pending, so this DDL is not wired into meta/_journal). Additive-only.
CREATE TABLE IF NOT EXISTS "sale_listings" (
  "id" serial PRIMARY KEY NOT NULL,
  "category" text NOT NULL DEFAULT 'presale',
  "status" text NOT NULL DEFAULT 'available',
  "cover_image" text,
  "gallery" jsonb DEFAULT '[]'::jsonb,
  "area_m2" numeric(10, 2),
  "bedrooms" integer,
  "bathrooms" integer,
  "price_amount" numeric(14, 2),
  "sort_order" integer NOT NULL DEFAULT 0,
  "published" boolean NOT NULL DEFAULT false,
  "translations" jsonb DEFAULT '{}'::jsonb,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sale_listings_published_idx" ON "sale_listings" ("published", "sort_order");
