-- Manual migration: per-placement billing overrides (cycle weeks + method).
-- Additive. Global defaults live in integration_settings key 'homestay_billing'.
ALTER TABLE homestay_placements
  ADD COLUMN IF NOT EXISTS billing_cycle_weeks integer,
  ADD COLUMN IF NOT EXISTS billing_method text;
