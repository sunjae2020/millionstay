-- Additive: Korean real-estate sale/lease pricing on spaces.
-- 월간 요금(월세) / 보증금 / 구매(매매) 금액 / 예상 판매금액.
-- Currency follows base_currency (Metheim = KRW). Additive-only, nullable.
ALTER TABLE "spaces"
  ADD COLUMN IF NOT EXISTS "monthly_rent" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "deposit_amount" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "purchase_price" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "estimated_sale_price" numeric(14,2);
