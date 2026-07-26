-- Additive: Chart of Accounts (계정과목) master behind Settings → Cost Center.
-- Per-tenant GL account list; auto-posted journal_lines reference these codes.
CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "account_type" text NOT NULL DEFAULT 'asset',
  "parent_code" text,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "deleted_at" timestamp,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chart_of_accounts_code_unique" UNIQUE ("code")
);
