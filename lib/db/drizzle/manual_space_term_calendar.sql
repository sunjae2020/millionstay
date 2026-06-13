-- space_term_calendar — per-date "short-term conversion" markers set by owners
-- from owner-portal → Occupancy calendar. Flags a date range on a space to
-- operate under a different contract term ("short_term") with a per-night rate,
-- independent of the space's default product term. Lightweight calendar marker
-- + price; not (yet) wired into the booking pipeline.
-- Idempotent / additive — safe to re-run.

CREATE TABLE IF NOT EXISTS "space_term_calendar" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL,
  "date" date NOT NULL,
  "term_type" text DEFAULT 'short_term' NOT NULL,
  "daily_rate" numeric(10, 2),
  "currency" text DEFAULT 'AUD' NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "space_term_calendar_space_id_date_unique" UNIQUE("space_id", "date")
);

CREATE INDEX IF NOT EXISTS "idx_space_term_space_date" ON "space_term_calendar" ("space_id", "date");
