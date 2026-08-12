-- 요금 직접 입력(메뉴얼 선택) + 계약일.
--
-- 예약 요금은 기본적으로 연결된 숙박 상품(accommodation_catalog)의 요금표를
-- 따라간다. manual_pricing = TRUE 이면 그 연결을 끊고 아래 금액을 직접 입력한
-- 값으로 쓴다 — 요금표에 없는 개별 조건 계약을 위한 통로.
--   manual_pricing   요금 직접 입력 여부
--   deposit_amount   보증금
--   monthly_rent     월세
--   special_terms    특약 (자유 서술)
--   contract_date    계약일 (체크인과 별개)
-- Additive only; 기본값은 기존 동작(상품 요금표 그대로)을 그대로 재현한다.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "manual_pricing" boolean NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "deposit_amount" numeric(12, 2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "monthly_rent" numeric(12, 2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "special_terms" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "contract_date" date;
