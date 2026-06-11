-- Accommodation classification enums + add-on services catalogue.
-- Managed from property-admin → Settings → Add-on Services and the
-- Accommodation Product form. Idempotent / additive — safe to re-run.

-- 1) Enums (CREATE TYPE has no IF NOT EXISTS, so guard with a DO block) -------
DO $$ BEGIN
  CREATE TYPE "contract_term" AS ENUM ('short_term', 'mid_term', 'long_term');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "room_type" AS ENUM ('room_share', 'house_share', 'entire_place', 'homestay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "meal_plan" AS ENUM ('none', 'partial_board', 'full_board');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "guest_age" AS ENUM ('adult', 'minor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Classification columns on accommodation_catalog (nullable, additive) -----
ALTER TABLE "accommodation_catalog" ADD COLUMN IF NOT EXISTS "contract_term" "contract_term";
ALTER TABLE "accommodation_catalog" ADD COLUMN IF NOT EXISTS "room_type" "room_type";
ALTER TABLE "accommodation_catalog" ADD COLUMN IF NOT EXISTS "meal_plan" "meal_plan";
ALTER TABLE "accommodation_catalog" ADD COLUMN IF NOT EXISTS "guest_age" "guest_age";

-- 3) Add-on services catalogue (open, priced, admin-managed) ------------------
CREATE TABLE IF NOT EXISTS "addon_services" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'other' NOT NULL,
  "base_price" real,
  "currency" text DEFAULT 'AUD' NOT NULL,
  "unit" text DEFAULT 'per_booking' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "addon_services_code_unique" UNIQUE("code")
);

-- 4) Accommodation ↔ add-on service junction ---------------------------------
CREATE TABLE IF NOT EXISTS "accommodation_addons" (
  "id" serial PRIMARY KEY NOT NULL,
  "accommodation_id" integer NOT NULL,
  "addon_service_id" integer NOT NULL,
  "price_override" real,
  "is_included" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "accommodation_addons_accommodation_idx"
  ON "accommodation_addons" ("accommodation_id");

-- 5) Seed the five standard add-on services (idempotent on code) --------------
INSERT INTO "addon_services" ("code", "name", "category", "unit", "sort_order") VALUES
  ('airport_pickup',    'Airport Pickup',     'transport', 'per_trip',    10),
  ('airport_dropoff',   'Airport Drop-off',   'transport', 'per_trip',    20),
  ('initial_settlement','Initial Settlement', 'living',    'per_booking', 30),
  ('extra_linen',       'Extra Linen',        'supplies',  'per_item',    40),
  ('prepaid_sim',       'Prepaid Phone (SIM)','telecom',   'per_item',    50)
ON CONFLICT ("code") DO NOTHING;
