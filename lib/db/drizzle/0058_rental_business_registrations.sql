-- 0058 — 임대사업자 등록증을 회사 설정에서 계정관리(임대인·소유주)로 옮긴다
--
-- 0056 은 등록증 머릿말을 "회사당 한 벌"로 보고 integration_settings KV(key
-- `rental_business_registration`)에 담았다. 그런데 등록증은 회사가 아니라 임대인에게
-- 붙는 문서다 — 한 인스턴스가 여러 임대인의 물건을 관리하고, 한 임대인이 등록증을
-- 여러 벌 가질 수도 있다. 그래서 계정에 매달린 정식 테이블로 승격한다.
--
-- 세대 목록(rental_business_units)에는 registration_id 를 달아 어느 등록증에 실린
-- 세대인지 가리키게 하고, 계약(contracts)에는 이 계약서에 실을 등록증을 고르는 칸을
-- 둔다. 등록임대주택이 아닌 물건도 계약하므로 계약의 기본값은 NULL(= 선택 안 함)이다.
--
-- Additive only. KV 에 있던 등록증 한 벌은 아래에서 행으로 옮기고, 임대사업자
-- 성명이 계정 이름과 같으면 그 계정에 붙인다(같은 이름이 둘 이상이면 미지정으로 둔다).
CREATE TABLE IF NOT EXISTS "rental_business_registrations" (
  "id" serial PRIMARY KEY,
  "account_id" integer,
  "registration_no" text NOT NULL DEFAULT '',
  "first_registered_on" text,
  "operator_name" text NOT NULL DEFAULT '',
  "operator_reg_no" text,
  "foreigner_reg_no" text,
  "nationality" text,
  "visa_status" text,
  "visa_period" text,
  "address" text,
  "phone" text,
  "mobile" text,
  "issuing_authority" text,
  "note" text NOT NULL DEFAULT '',
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rental_business_registrations_account_id_idx"
  ON "rental_business_registrations" ("account_id");

ALTER TABLE "rental_business_units" ADD COLUMN IF NOT EXISTS "registration_id" integer;
CREATE INDEX IF NOT EXISTS "rental_business_units_registration_id_idx"
  ON "rental_business_units" ("registration_id");

ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "rental_business_registration_id" integer;

-- ── KV 등록증 → 행 이관 ──────────────────────────────────────────────────────
-- 이미 옮겨 둔 인스턴스에서 두 번 돌아도 등록증이 겹치지 않도록 NOT EXISTS 로 막는다.
INSERT INTO "rental_business_registrations" (
  "account_id", "registration_no", "first_registered_on", "operator_name", "operator_reg_no",
  "foreigner_reg_no", "nationality", "visa_status", "visa_period",
  "address", "phone", "mobile", "issuing_authority", "note"
)
SELECT
  (
    -- 임대사업자 성명이 계정 이름과 정확히 같을 때만 붙인다. 동명이인·동명법인이면
    -- 사람이 골라야 하므로 미지정(NULL)으로 두고 계정 탭에서 가져가게 한다.
    SELECT a."id" FROM "accounts" a
    WHERE a."deleted_at" IS NULL
      AND a."name" = (kv."value"::jsonb ->> 'operator_name')
    GROUP BY a."id"
    HAVING count(*) = 1
    LIMIT 1
  ),
  COALESCE(kv."value"::jsonb ->> 'registration_no', ''),
  NULLIF(kv."value"::jsonb ->> 'first_registered_on', ''),
  COALESCE(kv."value"::jsonb ->> 'operator_name', ''),
  NULLIF(kv."value"::jsonb ->> 'operator_reg_no', ''),
  NULLIF(kv."value"::jsonb ->> 'foreigner_reg_no', ''),
  NULLIF(kv."value"::jsonb ->> 'nationality', ''),
  NULLIF(kv."value"::jsonb ->> 'visa_status', ''),
  NULLIF(kv."value"::jsonb ->> 'visa_period', ''),
  NULLIF(kv."value"::jsonb ->> 'address', ''),
  NULLIF(kv."value"::jsonb ->> 'phone', ''),
  NULLIF(kv."value"::jsonb ->> 'mobile', ''),
  NULLIF(kv."value"::jsonb ->> 'issuing_authority', ''),
  COALESCE(kv."value"::jsonb ->> 'note', '')
FROM "integration_settings" kv
WHERE kv."key" = 'rental_business_registration'
  AND kv."value" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "rental_business_registrations");

-- 기존 세대는 모두 그 한 벌짜리 등록증에 실려 있던 것이므로 통째로 이어 붙인다.
UPDATE "rental_business_units" u
SET "registration_id" = (SELECT r."id" FROM "rental_business_registrations" r ORDER BY r."id" LIMIT 1)
WHERE u."registration_id" IS NULL
  AND EXISTS (SELECT 1 FROM "rental_business_registrations");
