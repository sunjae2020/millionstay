-- 퇴거 세대 정산 확인서 — 기준일자 / 정산구분 수동 지정
--
-- 두 값 모두 지금까지 파생값이었다. 기준일자는 finalized_at ?? proposed_at ??
-- created_at, 정산구분은 그 날짜와 계약 종료일의 대소 비교. 그래서 "8/28 퇴거인데
-- 확인서는 8/19에 만들어 둔" 건이 중도퇴거로 찍혔다 — 서류를 만든 날은 정산을 끊은
-- 날이 아니다.
--
-- 두 컬럼 모두 NULL 이면 종전 파생 규칙 그대로 동작한다. 값이 들어간 순간에만
-- 운영자의 지정이 자동 판정을 이긴다. 기존 행은 건드리지 않는다.
--
-- 롤백: ALTER TABLE deposit_settlements DROP COLUMN as_of_date, DROP COLUMN settlement_type;
-- (데이터 손실은 운영자가 직접 지정한 값뿐이고, 지우면 자동 규칙으로 되돌아간다.)
--
-- Additive-only. 적용 완료: MillionStay / Metheim 두 인스턴스 (2026-08-28).

ALTER TABLE "deposit_settlements" ADD COLUMN IF NOT EXISTS "as_of_date" date;
ALTER TABLE "deposit_settlements" ADD COLUMN IF NOT EXISTS "settlement_type" text;
