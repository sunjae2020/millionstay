-- Per-space lease price options: multiple (deposit → monthly rent) tiers with an
-- optional promotional monthly rate. Powers the Metheim 임대료 (rate-card) options
-- table on the public rent listing. Higher deposit ⇒ lower monthly rent; the promo
-- column ("빨간색") holds the discounted monthly rate, kept separate from the
-- standard rent. Additive-only, display/reference data — does not feed the
-- short-term booking engine (accommodation_catalog).
CREATE TABLE IF NOT EXISTS "space_rent_options" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL,
  "deposit_amount" numeric(14,2) NOT NULL,
  "monthly_rent" numeric(14,2) NOT NULL,
  "promo_monthly_rent" numeric(14,2),
  "currency" text NOT NULL DEFAULT 'KRW',
  "display_order" integer NOT NULL DEFAULT 0,
  "is_default" boolean NOT NULL DEFAULT false,
  "deleted_at" timestamp,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "space_rent_options_space_id_idx" ON "space_rent_options" ("space_id");
