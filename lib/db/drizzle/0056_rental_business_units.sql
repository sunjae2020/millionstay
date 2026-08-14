-- 0056 — 임대사업자 등록증(별지 제3호서식)에 등재된 민간임대주택 목록
--
-- 회사 정보(Settings → Organisation)에 "임대사업자 등록증" 탭이 생기면서, 등록증
-- 표에 줄줄이 적힌 세대(호수·주택구분·주택종류·주택유형·전용면적·주택등록일·
-- 임대개시일·등록이력)를 원장으로 들고 있어야 한다. 종이 등록증만 스캔해 두면
-- "이 호실이 등록된 임대주택인지"를 계약·정산 화면에서 확인할 길이 없다.
--
-- 등록증 머릿말(등록번호·최초등록일·임대사업자명·법인등록번호·주소·전화)은 회사당
-- 한 벌이라 integration_settings KV(key `rental_business_registration`)에 두고, 여러
-- 줄짜리 세대 목록만 이 테이블에 담는다.
--
-- space_id 는 등록증의 호수를 spaces 원장 세대와 잇는 고리다. 관청 문서가 우리
-- 원장보다 앞설 수 있으므로 nullable(미연결 허용). Additive only.
CREATE TABLE IF NOT EXISTS "rental_business_units" (
  "id" serial PRIMARY KEY,
  "unit_no" text NOT NULL,
  "building_address" text NOT NULL DEFAULT '',
  "acquisition_type" text,
  "housing_kind" text,
  "housing_type" text,
  "exclusive_area_label" text,
  "registered_on" text,
  "lease_started_on" text,
  "registration_history" text,
  "space_id" integer,
  "note" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rental_business_units_space_id_idx" ON "rental_business_units" ("space_id");
