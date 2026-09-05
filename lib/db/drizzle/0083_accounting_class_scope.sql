-- HQ / 지점 / 팀 회계 접근 범위 (Class 차원)
--
-- 지점이 여러 개인 운영에서 "다른 지점 장부가 다 보인다"는 것은 사고다. QuickBooks
-- 의 Class 를 그대로 빌려온다 — 회계 레코드마다 **어느 지점·팀에 귀속되는지**를
-- 달고, 보는 사람의 소속으로 걸러 준다.
--
--   본사(HQ) → 전부. 지점원 → 자기 지점 + 그 아래 팀. 팀원 → 자기 팀.
--   + 명시적 공유(accounting_shares)로 예외를 연다.
--
-- ⚠️ **기본은 꺼져 있다.** `integration_settings` 의 `accounting.class_scope` 가
-- "1" 일 때만 강제된다. 켜지 않으면 지금과 동작이 완전히 같다 — 소속을 다 넣기도
-- 전에 강제하면 아무도 아무것도 못 본다.
--
-- ⚠️ 소속이 없는 행(branch_id·team_id 둘 다 NULL)은 **보이게** 둔다(fail-open).
-- 이관 전 과거 데이터가 통째로 사라지는 것이 접근 통제 누락보다 나쁘다. 배정이
-- 끝난 뒤 fail-closed 로 바꾸는 것은 accountingScope.ts 의 한 줄이다.
--
-- Additive-only.

CREATE TABLE IF NOT EXISTS "branches" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "code" text,
  -- 본사는 전 지점을 본다. 여러 개일 수 있다(본사·재무본부 등).
  "is_headquarters" boolean NOT NULL DEFAULT false,
  "address" text,
  "phone" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "branches_code_key" ON "branches" ("code") WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "teams" (
  "id" serial PRIMARY KEY,
  -- 팀은 반드시 지점에 속한다. 지점 없는 팀은 "어느 지점 사람이 보나"에 답이 없다.
  "branch_id" integer NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "teams_branch_idx" ON "teams" ("branch_id");

-- 직원의 소속. 팀만 있고 지점이 비어 있으면 팀의 지점을 따른다.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "branch_id" integer;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "team_id" integer;

-- 거래의 Class. 담당자(owner_user_id → 없으면 created_by)에서 파생해 **스탬프**한다.
-- 매번 조회 시 파생하면 담당자가 부서를 옮긴 순간 과거 장부의 귀속이 통째로 바뀐다.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "branch_id" integer;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "team_id" integer;
CREATE INDEX IF NOT EXISTS "transactions_class_idx" ON "transactions" ("branch_id", "team_id");

-- 명시적 공유 — 소속이 다른 지점·팀에 특정 레코드만 열어 준다.
CREATE TABLE IF NOT EXISTS "accounting_shares" (
  "id" serial PRIMARY KEY,
  "record_type" text NOT NULL,          -- 'transaction' 등
  "record_id" integer NOT NULL,
  "share_branch_id" integer,
  "share_team_id" integer,
  "note" text,
  "created_by" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "accounting_shares_record_idx" ON "accounting_shares" ("record_type", "record_id");
-- 같은 레코드를 같은 대상에게 두 번 공유하는 것은 의미가 없다.
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_shares_unique"
  ON "accounting_shares" ("record_type", "record_id", COALESCE("share_branch_id", 0), COALESCE("share_team_id", 0));
