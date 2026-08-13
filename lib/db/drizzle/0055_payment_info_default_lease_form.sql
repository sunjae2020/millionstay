-- 서식별 기본 납부 계좌
-- 계약서 서식(일반/주택표준/민간임대표준)마다 수납 계좌가 다른 회사가 있어서,
-- 어느 계좌를 어느 서식의 기본값으로 쓸지 계좌 쪽에 적어 둔다. 계약에서 고른
-- 계좌(contracts.rent_payment_info_id / deposit_payment_info_id)가 항상 우선이고,
-- 이 값은 새 계약의 초기값과 문서 발급 시 폴백으로만 쓰인다.
ALTER TABLE "payment_info" ADD COLUMN IF NOT EXISTS "default_for_lease_form" text;
