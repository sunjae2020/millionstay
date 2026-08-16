-- 임대사업자 등록증에 민간임대주택 법정 기재사항을 담는다.
--
-- 표준임대차계약서(별지 제24호서식) 첫 장의 법정 기재사항은 계약마다 새로 적을
-- 값이 아니라 등록증 한 벌에 딸린 성질이다. 여기에 기본값으로 두고, 계약에서
-- 임대인(갑)과 서식을 고르면 contracts.mlt_* 로 복사한다(복사 뒤 계약 쪽 수정이
-- 최종이며 등록증으로 되돌아오지 않는다).
--
-- 임대사업자 등록번호 칸은 만들지 않는다 — registration_no 가 곧 그 값이다.

ALTER TABLE "rental_business_registrations"
  ADD COLUMN IF NOT EXISTS "mlt_housing_type" text,
  ADD COLUMN IF NOT EXISTS "mlt_rental_type" text,
  ADD COLUMN IF NOT EXISTS "mlt_rental_term_years" integer,
  ADD COLUMN IF NOT EXISTS "mlt_rental_type_other" text,
  ADD COLUMN IF NOT EXISTS "mlt_supply_kind" text,
  ADD COLUMN IF NOT EXISTS "mlt_mandatory_start_date" text,
  ADD COLUMN IF NOT EXISTS "mlt_over_100_units" boolean,
  ADD COLUMN IF NOT EXISTS "mlt_ancillary_facilities" text,
  ADD COLUMN IF NOT EXISTS "mlt_senior_lien" boolean,
  ADD COLUMN IF NOT EXISTS "mlt_senior_lien_kind" text,
  ADD COLUMN IF NOT EXISTS "mlt_senior_lien_amount" numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "mlt_senior_lien_date" text,
  ADD COLUMN IF NOT EXISTS "mlt_tax_arrears" boolean,
  ADD COLUMN IF NOT EXISTS "mlt_guarantee_status" text,
  ADD COLUMN IF NOT EXISTS "mlt_guarantee_amount" numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "mlt_guarantee_none_reason" text,
  ADD COLUMN IF NOT EXISTS "mlt_late_fee_rate" numeric(5, 2);
