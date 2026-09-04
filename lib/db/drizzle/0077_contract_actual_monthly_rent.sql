-- 실 차임(월세) — 계약서상의 차임(monthly_rent)과 별개로 세입자가 실제 납부하는 금액.
-- NULL 이면 monthly_rent 로 청구하므로 기존 계약의 월세 청구 동작은 그대로다.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS actual_monthly_rent numeric(12,2);
