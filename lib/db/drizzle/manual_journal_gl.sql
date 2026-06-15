-- Phase 4e: minimal double-entry general ledger (net-new). Entries auto-posted
-- from financial events; posting_key enforces idempotency. Money = numeric.
-- Idempotent / additive — safe to re-run.

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "posting_key" text NOT NULL UNIQUE,
  "entry_date" date NOT NULL,
  "description" text NOT NULL,
  "source_type" text,
  "source_id" integer,
  "currency" text NOT NULL DEFAULT 'AUD',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "journal_lines" (
  "id" serial PRIMARY KEY NOT NULL,
  "entry_id" integer NOT NULL,
  "account_code" text NOT NULL,
  "account_name" text NOT NULL,
  "debit" numeric(12,2) NOT NULL DEFAULT '0',
  "credit" numeric(12,2) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_journal_lines_entry" ON "journal_lines" ("entry_id");
CREATE INDEX IF NOT EXISTS "idx_journal_entries_date" ON "journal_entries" ("entry_date");
