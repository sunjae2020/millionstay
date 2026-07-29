-- 민간임대주택 표준임대차계약서(별지 제24호서식) 법정 기재사항
--
-- 이 서식은 등록임대사업자가 반드시 써야 하는 법정서식이고, 서식이 요구하는
-- 항목 중 아래 것들은 우리 도메인 어디에도 저장할 곳이 없었다. 계약 시점의
-- 고지 내용(선순위 담보권·체납·보증 가입)이 그대로 계약서에 박히므로
-- 물건이 아니라 **계약에** 스냅숏으로 남긴다.
--
-- 주민등록번호는 일부러 넣지 않는다 — 개인정보보호법상 법정 근거 없는 수집·
-- 저장을 피하고, 서식의 해당 칸은 비워 발급한 뒤 수기 기재한다.
--
-- Additive-only. 중도금(interim_payment)은 0019 가 빠뜨린 칸이라 여기서 채운다.
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "interim_payment" numeric(12, 2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "interim_payment_date" text;

-- 임대사업자 등록번호 — 예 "2026-여수시-임대사업자-11".
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_landlord_rental_biz_no" text;
-- 주택 유형: apartment | row_house | multiplex | multi_family | other
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_housing_type" text;
-- 민간임대주택의 종류: public_support | long_term | short_term (+ 의무기간 년수 10·8·6·4)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_rental_type" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_rental_term_years" integer;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_rental_type_other" text;
-- 공급 방식: built(건설) | purchased(매입)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_supply_kind" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_mandatory_start_date" text;
-- 100세대 이상 민간임대주택단지 해당 여부 — 임대료 증액 기준이 달라진다.
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_over_100_units" boolean;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_ancillary_facilities" text;

-- 선순위 담보권 등 권리관계 (없으면 false, 있으면 종류·설정금액·설정일자)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_senior_lien" boolean;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_senior_lien_kind" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_senior_lien_amount" numeric(14, 2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_senior_lien_date" text;
-- 국세ㆍ지방세 체납사실
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_tax_arrears" boolean;

-- 임대보증금 보증 가입 여부: joined | partial | not_joined
-- 미가입 법정사유: zero | priority | public_landlord | tenant_guarantee
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_guarantee_status" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_guarantee_amount" numeric(14, 2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_guarantee_none_reason" text;
-- 제1조④ 연체이율(연 %)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "mlt_late_fee_rate" numeric(5, 2);
