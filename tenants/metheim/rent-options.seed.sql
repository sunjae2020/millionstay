-- Metheim 여수 임대료 (rate card) → space_rent_options for the 8 type spaces.
-- Source: "메트하임 여수 임대료" sheet. Units converted from 만원 to KRW.
-- 빨간색(프로모션) → promo_monthly_rent, kept separate from the standard monthly_rent.
-- Higher deposit ⇒ lower monthly rent. The ₩ figures under the red numbers are the
-- exact monthly amounts (e.g. ₩416,667 = 5,000,000/년 ÷ 12), the 만원 red number is
-- that rounded.
--
-- Rate-group → type-space mapping (sheet defines A/B, C, D, E only; the "-1" variants
-- inherit their base letter's rates):
--   A/B → 276 A타입, 277 A-1타입, 278 B타입
--   C   → 279 C타입
--   D   → 280 D타입, 282 D-1타입
--   E   → 281 E타입, 283 E-1타입
--
-- Idempotent: clears + re-inserts options for spaces 276–283 on every run.
-- Apply:  psql "$METHEIM_DATABASE_URL" -f tenants/metheim/rent-options.seed.sql
BEGIN;

DELETE FROM space_rent_options WHERE space_id BETWEEN 276 AND 283;

-- A/B 타입 (원룸): 보증금 300만/월 50만 · 보증금 1000만/월 50만 → 프로모 ₩416,667
INSERT INTO space_rent_options
  (space_id, deposit_amount, monthly_rent, promo_monthly_rent, currency, display_order, is_default) VALUES
  (276,  3000000, 500000, NULL,   'KRW', 0, true),
  (276, 10000000, 500000, 416667, 'KRW', 1, false),
  (277,  3000000, 500000, NULL,   'KRW', 0, true),
  (277, 10000000, 500000, 416667, 'KRW', 1, false),
  (278,  3000000, 500000, NULL,   'KRW', 0, true),
  (278, 10000000, 500000, 416667, 'KRW', 1, false);

-- C 타입 (원룸): 300만/60 · 1000만/60→50 · 1400만/55→46 (₩500,000 / ₩458,333)
INSERT INTO space_rent_options
  (space_id, deposit_amount, monthly_rent, promo_monthly_rent, currency, display_order, is_default) VALUES
  (279,  3000000, 600000, NULL,   'KRW', 0, true),
  (279, 10000000, 600000, 500000, 'KRW', 1, false),
  (279, 14000000, 550000, 458333, 'KRW', 2, false);

-- D 타입 (투룸): 500만/80 · 1000만/80→67 · 1500만/75→63 · 2000만/70→59
INSERT INTO space_rent_options
  (space_id, deposit_amount, monthly_rent, promo_monthly_rent, currency, display_order, is_default) VALUES
  (280,  5000000, 800000, NULL,   'KRW', 0, true),
  (280, 10000000, 800000, 666667, 'KRW', 1, false),
  (280, 15000000, 750000, 625000, 'KRW', 2, false),
  (280, 20000000, 700000, 583333, 'KRW', 3, false),
  (282,  5000000, 800000, NULL,   'KRW', 0, true),
  (282, 10000000, 800000, 666667, 'KRW', 1, false),
  (282, 15000000, 750000, 625000, 'KRW', 2, false),
  (282, 20000000, 700000, 583333, 'KRW', 3, false);

-- E 타입 (투룸): 500만/90 · 1000만/90→75 · 1500만/85→71 · 2400만/75→63
INSERT INTO space_rent_options
  (space_id, deposit_amount, monthly_rent, promo_monthly_rent, currency, display_order, is_default) VALUES
  (281,  5000000, 900000, NULL,   'KRW', 0, true),
  (281, 10000000, 900000, 750000, 'KRW', 1, false),
  (281, 15000000, 850000, 708333, 'KRW', 2, false),
  (281, 24000000, 750000, 625000, 'KRW', 3, false),
  (283,  5000000, 900000, NULL,   'KRW', 0, true),
  (283, 10000000, 900000, 750000, 'KRW', 1, false),
  (283, 15000000, 850000, 708333, 'KRW', 2, false),
  (283, 24000000, 750000, 625000, 'KRW', 3, false);

-- Set the entry (lowest-deposit, standard) monthly rent as the headline "from"
-- price + admin lease fields. Status is intentionally left untouched here so the
-- data can be loaded without publishing before the options-table UI is deployed.
UPDATE spaces SET
  base_currency = 'KRW',
  base_weekly_price = v.monthly,
  monthly_rent      = v.monthly,
  deposit_amount    = v.deposit,
  updated_at = now()
FROM (VALUES
  (276, 500000::numeric,  3000000::numeric),
  (277, 500000,  3000000),
  (278, 500000,  3000000),
  (279, 600000,  3000000),
  (280, 800000,  5000000),
  (282, 800000,  5000000),
  (281, 900000,  5000000),
  (283, 900000,  5000000)
) AS v(id, monthly, deposit)
WHERE spaces.id = v.id;

COMMIT;

-- ── GO-LIVE (run together with the options-table UI deploy) ──────────────────
-- Publishes the 8 type spaces to the public /rent listing. Keep commented until
-- the frontend that renders the 보증금→월세 options table is deployed, otherwise
-- the live site shows bare, option-less listings.
--   UPDATE spaces SET status = '공실', updated_at = now() WHERE id BETWEEN 276 AND 283;

-- Verify
SELECT s.id, s.name, s.status, s.base_weekly_price,
       count(o.id) AS options, count(o.promo_monthly_rent) AS promos
FROM spaces s
LEFT JOIN space_rent_options o ON o.space_id = s.id
WHERE s.id BETWEEN 276 AND 283
GROUP BY s.id, s.name, s.status, s.base_weekly_price
ORDER BY s.id;
