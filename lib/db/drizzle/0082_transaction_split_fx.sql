-- 거래 분할 배분 + 기준통화 스탬프
--
-- ## 분할 배분
-- 입금 한 건이 여러 지출로 갈라지는 흐름이 임대 실무의 기본이다 — 세입자에게
-- 월세를 받아 집주인에게 넘기고 수수료를 뗀다. 지금은 그 관계를 표현할 수 없어
-- 세 건의 무관한 거래로 남는다("이 송금이 어느 입금에서 나왔나"에 답이 없다).
--
--   parent_transaction_id  자식 → 원본 입금
--   split_role             'source' 원본 | 'disbursement' 나간 돈 | 'retained' 유보(우리 몫)
--
-- ## 기준통화
-- 통화가 섞이면 합계가 무의미해진다. 거래 시점의 환율로 기준통화 환산액을
-- **스탬프**한다 — 나중에 다시 계산하면 그때의 환율이 적용돼 과거 장부가 바뀐다.
-- ⚠️ 환율을 못 구하면 NULL 로 둔다. 절대 1 로 채우지 않는다 — 1 은 "환산했는데
-- 같았다"는 뜻이라 결측과 구분되지 않고, 그 순간 오류가 조용히 묻힌다.
--
-- Additive-only.

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "parent_transaction_id" integer;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "split_role" text;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "base_currency" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "base_amount" numeric(16,2);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fx_rate" numeric(18,8);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fx_date" text;

CREATE INDEX IF NOT EXISTS "transactions_parent_idx" ON "transactions" ("parent_transaction_id");
