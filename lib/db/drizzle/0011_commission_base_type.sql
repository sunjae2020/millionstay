-- Additive: configurable commission base per plan (월세 기반 정합).
--   upfront (default, unchanged) | monthly | converted (deposit + monthly×100)
-- Applied directly to prod via psql. Additive-only; existing plans keep 'upfront'.
ALTER TABLE "homestay_commission_plans"
  ADD COLUMN IF NOT EXISTS "base_type" text NOT NULL DEFAULT 'upfront';
