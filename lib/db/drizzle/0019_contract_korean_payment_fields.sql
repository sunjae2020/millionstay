-- Korean-lease payment structure on contracts
-- (계약서 구분 / 계약금·계약금입금일 / 잔금·잔금입금일 / 월세·월세 납입일)
-- Additive-only. 보증금 reuses bond_amount, 입주일/퇴거일 reuse start_date/end_date.
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contract_category" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "down_payment" numeric(12, 2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "down_payment_date" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "balance_amount" numeric(12, 2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "balance_date" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "monthly_rent" numeric(12, 2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "rent_due_day" integer;
