-- 계정 메신저(SNS) — 종류 + 아이디
--
-- 한국·아시아 고객은 이메일이나 전화보다 카카오톡·LINE 으로 연락한다. 연락처
-- (contacts)에는 이미 sns_type/sns_id 가 있었지만 계정(accounts)에는 없어서,
-- 계약서 당사자 표를 계정에서 채우는 구조상 임차인의 메신저를 실을 자리가 없었다.
--
-- 원본은 사람의 것이므로 연락처에 두고, 여기에는 대표 연락처에서 복사된 값이
-- 들어간다(주민등록번호와 같은 방식). 계약 화면의 임차인(을) 카드에 노출된다.
-- 법인 계정도 채널 계정을 가질 수 있어 entity_kind 로 가르지 않는다.
--
-- 롤백: ALTER TABLE accounts DROP COLUMN sns_type, DROP COLUMN sns_id;
--
-- Additive-only. 두 컬럼 모두 nullable 이라 기존 행은 그대로 둔다.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "sns_type" text;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "sns_id" text;
