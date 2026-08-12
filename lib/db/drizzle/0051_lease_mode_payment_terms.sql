-- 0051 — 임대 유형(장기/단기) 스위치 + 단기 요금 필드 + 예약 결제 조건
--
-- 계약/예약 상세의 "결제 조건"과 "재무" 두 섹션이 서로 다른 임대 모델(한국식
-- 전월세 vs 호주식 주간요금)을 동시에 노출해 혼란을 주던 것을 하나의 스위치로
-- 정리한다. lease_mode 로 한 쪽만 보여주고, 잔금·보증금·기간 컬럼은 공유한다.
--
-- Additive only. 기존 weekly_rate 는 삭제하지 않고 rate_amount/rate_period 로
-- 백필한 뒤 읽기 호환용으로 남긴다.

-- ── contracts ──────────────────────────────────────────────────────────────
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "lease_mode" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "rate_period" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "rate_amount" numeric(12,2);

-- ── bookings ───────────────────────────────────────────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "lease_mode" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rate_period" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rate_amount" numeric(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "advance_amount" numeric(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "down_payment" numeric(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "down_payment_date" date;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "interim_payment" numeric(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "interim_payment_date" date;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "balance_amount" numeric(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "balance_date" date;

-- ── 백필 ───────────────────────────────────────────────────────────────────
-- 월세가 잡혀 있으면 전월세형(장기), 아니면 요금형(단기)으로 본다.
UPDATE "contracts"
   SET "lease_mode" = CASE WHEN COALESCE("monthly_rent", 0) > 0 THEN 'long' ELSE 'short' END
 WHERE "lease_mode" IS NULL;

UPDATE "bookings"
   SET "lease_mode" = CASE WHEN COALESCE("monthly_rent", 0) > 0 THEN 'long' ELSE 'short' END
 WHERE "lease_mode" IS NULL;

-- 기존 주간요금 → 요금 주기 'weekly' + 요금액
UPDATE "contracts"
   SET "rate_amount" = "weekly_rate", "rate_period" = 'weekly'
 WHERE "rate_amount" IS NULL AND COALESCE("weekly_rate", 0) > 0;

UPDATE "bookings"
   SET "rate_amount" = "agreed_weekly_rate", "rate_period" = 'weekly'
 WHERE "rate_amount" IS NULL AND COALESCE("agreed_weekly_rate", 0) > 0;
