-- 정산 확인서 — 보증금 출처 표기 + 회수 인보이스 링크
--
-- 보증금(B)은 "실제로 받은 돈"과 "계약서에 적힌 금액"이 다를 수 있다. 구분이 없으면
-- 받은 적 없는 보증금을 환급 처리하거나, 2100 에 없는 부채를 상계하게 된다.
-- deposit_source 는 그 출처를 남기고, invoice_id 는 C<0 일 때 부족분을 회수한
-- 인보이스를 가리킨다(확인서 = 정본, 인보이스 = 회수 도구).
--
-- Additive-only.
ALTER TABLE "deposit_settlements" ADD COLUMN IF NOT EXISTS "deposit_source" text;
ALTER TABLE "deposit_settlements" ADD COLUMN IF NOT EXISTS "invoice_id" integer;
