-- 결제 일정에 방향(AR/AP)을 준다
--
-- 0079 의 payment_schedules 는 "받을 돈"만 표현했다. 임대 실무는 한 달에 두 번
-- 움직인다 — 세입자에게 **받고**(AR), 집주인·업체에 **준다**(AP). AP 를 담지
-- 못하면 거래 원장이 지출을 어느 채무에 붙였는지 말할 수 없고, 미지급 관리가
-- 계약서 밖에 남는다.
--
-- Edubee 는 한 행에 ar_*/ap_* 를 겹쳐 넣지만 여기서는 `direction` 한 컬럼으로
-- 가른다. 그래야 0079 가 이미 가진 부분납 로직(paid_amount → partial)이 양쪽에
-- 그대로 재사용된다. 겹쳐 넣으면 컬럼이 두 배가 되고 부분납 계산이 갈라진다.
--
-- ⚠️ 유니크 인덱스를 반드시 갈아끼운다. 기존 (contract_id, kind, period) 는
-- 2026-03 월세의 AR 행과 AP 행이 **서로 충돌**한다 — 방향을 키에 넣어야 한다.
--
-- Additive-only. direction 기본값 'ar' 이므로 기존 행은 전부 받을 돈으로 남는다.

ALTER TABLE "payment_schedules" ADD COLUMN IF NOT EXISTS "direction" text NOT NULL DEFAULT 'ar';
-- 이 회차의 상대방. AR 이면 세입자(계약의 tenant_account_id), AP 면 집주인·업체.
ALTER TABLE "payment_schedules" ADD COLUMN IF NOT EXISTS "counterparty_account_id" integer;
-- AP 행이 어느 AR 행에서 파생됐는지(월세를 받아 집주인에게 넘기는 짝). 정산
-- 순서를 읽고 "받았는데 아직 안 보냈다"를 찾는 데 쓴다.
ALTER TABLE "payment_schedules" ADD COLUMN IF NOT EXISTS "source_schedule_id" integer;

DROP INDEX IF EXISTS "payment_schedules_contract_kind_period_key";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_schedules_contract_dir_kind_period_key"
  ON "payment_schedules" ("contract_id", "direction", "kind", "period")
  WHERE "deleted_at" IS NULL AND "period" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "payment_schedules_direction_idx" ON "payment_schedules" ("direction", "status");
