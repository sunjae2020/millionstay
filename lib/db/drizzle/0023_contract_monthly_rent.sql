-- Contract-side monthly rent (월세), so contract creation can auto-fill the
-- promo-adjusted monthly rate from the selected 숙박상품 (Korean rent tier).
-- Additive; the column already exists on some tenant DBs (idempotent).
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "monthly_rent" numeric(12,2);
