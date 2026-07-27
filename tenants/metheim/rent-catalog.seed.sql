-- Metheim 여수 임대료 rate card, modelled in the CANONICAL relationship:
--   공간(spaces 276-283) ─< 숙박상품(accommodation_catalog, 보증금=deposit_amount)
--                              └─ 프로모션(promotions) via promotion_id
-- so a selected 보증금/월세 tier flows through booking → 계약 like any product.
-- 빨간색 프로모션 = a promotions row (promotion_type Amount, discount_amount =
-- 정상월세 − 프로모월세). Higher deposit ⇒ lower monthly rent.
--
-- Rate-group → type-space mapping: A/B→276/277/278, C→279, D→280/282, E→281/283.
-- Idempotent: rows are marked (accommodation item_description='metheim-rate-card',
-- promotion code 'MH_RENT_%') and cleared before re-insert. Safe only before any
-- real booking/계약 references these product rows.
-- Apply: psql "$METHEIM_DATABASE_URL" -f tenants/metheim/rent-catalog.seed.sql
BEGIN;

DELETE FROM accommodation_catalog
  WHERE space_id BETWEEN 276 AND 283 AND item_description = 'metheim-rate-card';
DELETE FROM promotions WHERE code LIKE 'MH_RENT_%';

CREATE TEMP TABLE _rc(space_id int, deposit numeric, monthly numeric, promo numeric) ON COMMIT DROP;
INSERT INTO _rc VALUES
  (276, 3000000,500000,NULL),(276,10000000,500000,416667),
  (277, 3000000,500000,NULL),(277,10000000,500000,416667),
  (278, 3000000,500000,NULL),(278,10000000,500000,416667),
  (279, 3000000,600000,NULL),(279,10000000,600000,500000),(279,14000000,550000,458333),
  (280, 5000000,800000,NULL),(280,10000000,800000,666667),(280,15000000,750000,625000),(280,20000000,700000,583333),
  (282, 5000000,800000,NULL),(282,10000000,800000,666667),(282,15000000,750000,625000),(282,20000000,700000,583333),
  (281, 5000000,900000,NULL),(281,10000000,900000,750000),(281,15000000,850000,708333),(281,24000000,750000,625000),
  (283, 5000000,900000,NULL),(283,10000000,900000,750000),(283,15000000,850000,708333),(283,24000000,750000,625000);

-- 프로모션: one Amount promotion per promo tier (discount = 정상 − 프로모 월세).
INSERT INTO promotions
  (name, code, term_type, promotion_type, discount_amount, applicable_to, billing_frequency, status, description)
SELECT
  format('메트하임 임대 · 보증금 %s만원 프로모션', (deposit/10000)::int),
  format('MH_RENT_%s_%s', space_id, (deposit/10000)::int),
  'LongTerm', 'Amount', (monthly - promo), 'SpecificSpace', 'Monthly', 'Active',
  '보증금 상향 시 월세 할인 (여수 임대료표)'
FROM _rc WHERE promo IS NOT NULL;

-- 숙박상품: one accommodation_catalog row per tier; promo tiers link to their promotion.
INSERT INTO accommodation_catalog
  (name, item_description, space_id, price, weekly_rate, deposit_amount, currency,
   contract_term, room_type, billing_frequency, min_contract_period, min_contract_period_unit,
   promotion_id, status, display_on_booking_page, display_on_invoice, gst_included)
SELECT
  format('보증금 %s만원', (r.deposit/10000)::int),
  'metheim-rate-card', r.space_id, r.monthly, r.monthly, r.deposit, 'KRW',
  'long_term', 'entire_place', 'Monthly', 1, 'months',
  p.id, 'Active', true, true, false
FROM _rc r
LEFT JOIN promotions p ON p.code = format('MH_RENT_%s_%s', r.space_id, (r.deposit/10000)::int);

COMMIT;

-- Verify
SELECT a.space_id, s.name AS type, count(*) AS products,
       count(a.promotion_id) AS with_promo, min(a.price) AS min_month, max(a.deposit_amount) AS max_deposit
FROM accommodation_catalog a JOIN spaces s ON s.id = a.space_id
WHERE a.space_id BETWEEN 276 AND 283 AND a.item_description = 'metheim-rate-card'
GROUP BY a.space_id, s.name ORDER BY a.space_id;
