-- Phase 2 of the homestay/share unification: itemised invoices.
-- An invoice may carry N line items (placement fee, deposit, monthly rent,
-- airport pickup, settlement…) whose total_amount sums to invoices.amount.
-- Legacy single-amount invoices keep working (zero rows). Idempotent / additive.

CREATE TABLE IF NOT EXISTS "invoice_line_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_id" integer NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "quantity" numeric(10,2) NOT NULL DEFAULT '1',
  "unit_amount" numeric(10,2) NOT NULL DEFAULT '0',
  "total_amount" numeric(10,2) NOT NULL DEFAULT '0',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_invoice_line_items_invoice"
  ON "invoice_line_items" ("invoice_id");
