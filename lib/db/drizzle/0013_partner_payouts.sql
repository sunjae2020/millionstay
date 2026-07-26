-- Additive: service-host / contractor payout ledger (외주비 회계). Applied
-- directly to prod via psql. Additive-only. GL accounts 5100 Contractor Expense /
-- 2200 Contractor Payable are code constants (no table).
CREATE TABLE IF NOT EXISTS "partner_payouts" (
  "id" serial PRIMARY KEY NOT NULL,
  "payout_ref" text NOT NULL UNIQUE,
  "service_host_id" integer NOT NULL,
  "source_type" text,
  "source_id" integer,
  "description" text,
  "amount" numeric(12, 2) NOT NULL DEFAULT '0',
  "currency" text NOT NULL DEFAULT 'AUD',
  "status" text NOT NULL DEFAULT 'Accrued',
  "posting_key" text,
  "accrued_at" timestamp with time zone NOT NULL DEFAULT now(),
  "approved_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_by" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "partner_payouts_host_idx" ON "partner_payouts" ("service_host_id", "status");
