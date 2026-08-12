-- 월세 정산 방식 (per-booking).
--
-- A month-billed stay starting mid-month owes a part-month (일할) amount for
-- its first period. These two columns record how that is handled:
--   rent_due_day             월세 납부일 (1–31, clamped to the month end)
--   prorate_with_next_month  TRUE  → 일할분을 다음 달 월세와 합산해 한 장으로 청구
--                            FALSE → 일할분을 즉시 별도 청구
-- Additive only; the default reproduces today's behaviour (carry-over on).

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rent_due_day" integer;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "prorate_with_next_month" boolean NOT NULL DEFAULT true;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_rent_due_day_range";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rent_due_day_range"
  CHECK ("rent_due_day" IS NULL OR ("rent_due_day" BETWEEN 1 AND 31));
