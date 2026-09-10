-- 계약 체결일(contracts.contract_date)
--
-- 계약서의 "계약 체결일"은 지금까지 저장된 값이 없어 signed_at → effective_date →
-- created_at 순으로 추정해 찍었고, 그 결과 입주일이 체결일로 인쇄되는 경우가 있었다.
-- 담당자가 직접 입력할 칸을 만든다. 값이 없으면 기존 추정 순서를 그대로 쓴다.
--
-- Additive-only.
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contract_date" text;
