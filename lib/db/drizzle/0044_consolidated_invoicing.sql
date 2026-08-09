-- 통합(단체) 청구 — 한 계정이 여러 공간을 임차할 때 매월 한 장의 청구서로 묶어
-- 발행·납부한다. 공간별(계약별) 인보이스는 그대로 발행되고 통합 청구서의 자식으로
-- 연결된다(회계·정산의 정본은 여전히 계약 단위). 통합 청구서는 금액 집계에서
-- 제외해야 이중 계상되지 않는다. Additive-only.

-- 계정별 설정: 사용 여부 · 청구 기준일(1~28) · 지난달 일할계산 이월 여부
ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "consolidated_billing_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consolidated_billing_day"     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "consolidated_prorate_enabled" boolean NOT NULL DEFAULT true;

-- 인보이스: 통합 청구서 여부 · 부모 링크 · 청구 대상 월(YYYY-MM)
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "invoice_kind"      text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "parent_invoice_id" integer,
  ADD COLUMN IF NOT EXISTS "billing_period"    text;

CREATE INDEX IF NOT EXISTS "invoices_parent_invoice_idx"
  ON "invoices" ("parent_invoice_id");
CREATE INDEX IF NOT EXISTS "invoices_account_period_idx"
  ON "invoices" ("account_id", "billing_period");

-- 인보이스 라인: 어느 호실/계약의 어느 기간분인지
ALTER TABLE "invoice_line_items"
  ADD COLUMN IF NOT EXISTS "space_id"     integer,
  ADD COLUMN IF NOT EXISTS "contract_id"  integer,
  ADD COLUMN IF NOT EXISTS "period_start" text,
  ADD COLUMN IF NOT EXISTS "period_end"   text;
