-- Additive: move-in / interim / move-out condition reports + tenant consensus
-- (MetHeim vision stages 2 & 5; see docs/proposals/CONDITION_REPORTS_SETTLEMENT.md).
-- Applied directly to prod via psql (drizzle journal baseline restoration still
-- pending, so this DDL is not wired into meta/_journal). Additive-only.
CREATE TABLE IF NOT EXISTS "condition_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "report_ref" text NOT NULL UNIQUE,
  "booking_id" integer NOT NULL,
  "phase" text NOT NULL DEFAULT 'move_in',
  "status" text NOT NULL DEFAULT 'draft',
  "title" text,
  "summary" text,
  "created_by" integer,
  "published_at" timestamp with time zone,
  "tenant_responded_at" timestamp with time zone,
  "finalized_at" timestamp with time zone,
  "content_hash" text,
  "published_snapshot" jsonb,
  "audit_trail" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "condition_reports_booking_idx" ON "condition_reports" ("booking_id", "phase");

CREATE TABLE IF NOT EXISTS "condition_report_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "condition_report_id" integer NOT NULL,
  "area_key" text,
  "label" text NOT NULL,
  "description" text,
  "condition_rating" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "condition_report_items_report_idx" ON "condition_report_items" ("condition_report_id");

CREATE TABLE IF NOT EXISTS "condition_report_photos" (
  "id" serial PRIMARY KEY NOT NULL,
  "condition_report_id" integer NOT NULL,
  "item_id" integer,
  "file_url" text NOT NULL,
  "thumbnail_url" text,
  "cloudinary_id" text,
  "caption" text,
  "content_hash" text,
  "taken_at" timestamp with time zone,
  "uploaded_by_type" text NOT NULL DEFAULT 'admin',
  "uploaded_by_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "condition_report_photos_report_idx" ON "condition_report_photos" ("condition_report_id");

CREATE TABLE IF NOT EXISTS "condition_report_responses" (
  "id" serial PRIMARY KEY NOT NULL,
  "item_id" integer NOT NULL,
  "decision" text NOT NULL,
  "comment" text,
  "responded_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "condition_report_responses_item_idx" ON "condition_report_responses" ("item_id");
