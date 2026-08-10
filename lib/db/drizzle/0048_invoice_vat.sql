-- 청구서 부가세 — 공급가액(invoices.amount)과 세액을 나눠 담는다.
-- amount 는 계속 공급가액(과세표준)이고 세입자가 내는 금액은 amount + tax_amount 다.
-- 한국 주택 임대는 면세라 기본값은 'none'(계산서). 상가·과세 서비스만 'exclusive'.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'none';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0;
