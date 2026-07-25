-- Additive: link a CS ticket to a maintenance work order (Phase 3 bridge).
-- Applied directly to prod via psql. Additive-only.
ALTER TABLE "cs_tickets" ADD COLUMN IF NOT EXISTS "work_order_id" integer;
