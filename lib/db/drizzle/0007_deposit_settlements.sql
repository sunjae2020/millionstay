-- Additive: move-out deposit settlement (Metheim vision stage 5; see
-- docs/proposals/CONDITION_REPORTS_SETTLEMENT.md). Reconciles the refundable
-- security deposit (Deposits Held 2100) into deductions + refund on finalize.
-- Applied directly to prod via psql (drizzle journal baseline still pending).
-- Additive-only.
CREATE TABLE IF NOT EXISTS "deposit_settlements" (
  "id" serial PRIMARY KEY NOT NULL,
  "settlement_ref" text NOT NULL UNIQUE,
  "booking_id" integer NOT NULL,
  "move_out_report_id" integer,
  "status" text NOT NULL DEFAULT 'draft',
  "deposit_held" numeric(10, 2) NOT NULL DEFAULT '0',
  "total_deducted" numeric(10, 2) NOT NULL DEFAULT '0',
  "refund_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "currency" text NOT NULL DEFAULT 'AUD',
  "notes" text,
  "created_by" integer,
  "proposed_at" timestamp with time zone,
  "tenant_ack_at" timestamp with time zone,
  "finalized_at" timestamp with time zone,
  "posting_key" text,
  "audit_trail" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deposit_settlements_booking_idx" ON "deposit_settlements" ("booking_id");

CREATE TABLE IF NOT EXISTS "deposit_deduction_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "deposit_settlement_id" integer NOT NULL,
  "condition_item_id" integer,
  "description" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "photo_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deposit_deduction_items_settlement_idx" ON "deposit_deduction_items" ("deposit_settlement_id");
