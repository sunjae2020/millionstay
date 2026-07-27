-- Integrate the Metheim 임대료 rate card into the canonical model:
-- lease price options now live on accommodation_catalog (숙박상품) with a proper
-- 보증금 column, and promotions (프로모션) via accommodation_catalog.promotion_id —
-- so a selected 보증금/월세 tier flows through booking → 계약 like any other product.
--
-- 1) Add the Korean lease deposit column to the product catalog. Additive.
ALTER TABLE "accommodation_catalog"
  ADD COLUMN IF NOT EXISTS "deposit_amount" numeric(14,2);

-- 2) Drop the short-lived standalone rate-card table (0021). It duplicated the
--    숙박상품 role and was disconnected from promotions/계약; superseded by the
--    accommodation_catalog + promotions integration above. Data is re-seeded as
--    catalog rows in tenants/metheim/rent-catalog.seed.sql.
DROP TABLE IF EXISTS "space_rent_options";
