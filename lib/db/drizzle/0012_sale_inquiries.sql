-- Additive: sale-listing inquiries with a privacy gate (관리자 1차 비공개 → 검수 →
-- 전달 결정). Applied directly to prod via psql. Additive-only.
CREATE TABLE IF NOT EXISTS "sale_inquiries" (
  "id" serial PRIMARY KEY NOT NULL,
  "listing_id" integer,
  "name" text,
  "email" text,
  "phone" text,
  "message" text,
  "locale" text,
  "status" text NOT NULL DEFAULT 'new',
  "revealed_at" timestamp with time zone,
  "revealed_by" integer,
  "forwarded_at" timestamp with time zone,
  "forward_note" text,
  "admin_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "sale_inquiries_status_idx" ON "sale_inquiries" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "sale_inquiries_listing_idx" ON "sale_inquiries" ("listing_id");
