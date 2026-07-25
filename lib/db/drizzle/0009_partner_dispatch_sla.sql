-- Additive: partner auto-dispatch + SLA for work orders (Phase 3).
-- Applied directly to prod via psql. Additive-only.
ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "service_host_id" integer,
  ADD COLUMN IF NOT EXISTS "dispatched_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "sla_ack_due_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "sla_status" text;

CREATE INDEX IF NOT EXISTS "work_orders_service_host_idx" ON "work_orders" ("service_host_id");
CREATE INDEX IF NOT EXISTS "work_orders_sla_idx" ON "work_orders" ("sla_status", "sla_ack_due_at");

ALTER TABLE "service_hosts"
  ADD COLUMN IF NOT EXISTS "specialties" jsonb NOT NULL DEFAULT '[]'::jsonb;
