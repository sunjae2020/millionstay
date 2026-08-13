-- 0054 — 계약 경로(acquisition channel) + 관련 비용 자동 연결
--
-- 계약이 어떤 경로로 성사됐는지를 계약 상세에서 하나 고르면(중개/자체/온라인/기타),
-- 그 경로의 상대 업체·개인을 계정관리에서 연결하고, 발생하는 수수료가 관련 비용
-- (contract_related_costs)에 자동으로 한 행 적재돼 결제(송금) 관리로 이어진다.
--
-- contracts:
--   acquisition_channel   brokerage | self | online | other
--   channel_account_id    연결한 계정(accounts.id)
--   channel_contact_*     선택 시점의 이름/연락처/이메일 스냅숏. 계정 레코드가 나중에
--                         바뀌어도 계약 시점의 사실이 남아야 하므로 계약에 복사한다.
--
-- contract_related_costs:
--   account_id            수취인 계정 링크(이름은 payee_name 에 스냅숏으로도 남음)
--   origin                'manual'(사람이 추가) | 'channel'(계약 경로에서 자동 생성).
--                         계약당 'channel' 행은 하나만 유지된다.
--
-- 수수료 기준액은 rental_fee_schedules(타입별 중개/자체/Working)에서 계산된다 —
-- 이 마이그레이션은 컬럼만 추가하고 값은 넣지 않는다. Additive only.
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "acquisition_channel" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "channel_account_id" integer;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "channel_contact_name" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "channel_contact_phone" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "channel_contact_email" text;

ALTER TABLE "contract_related_costs" ADD COLUMN IF NOT EXISTS "account_id" integer;
ALTER TABLE "contract_related_costs" ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'manual';
