-- 세입자 온보딩 — 로그인 없이 여는 링크 원장 (청구서 조회·입금 통보 / 서류 제출)
--
-- 서명이 필요한 단계는 이미 contract_signing_requests 를 탄다. 이 표는 서명이
-- 아닌 두 단계를 담는다: 청구서를 열어 계좌를 확인하고 입금을 알리는 링크,
-- 신분증·재직증명 등을 제출하는 링크. 지금까지 두 단계는 게스트 포털 로그인을
-- 요구했고, 실무에서는 그 요구가 카톡 사진 전송으로 우회되어 기록이 흩어졌다.
--
-- 신규 테이블이라 기존 데이터에 영향 없음(additive-only).
-- 롤백: DROP TABLE "tenant_access_links";
CREATE TABLE IF NOT EXISTS "tenant_access_links" (
  "id"            serial PRIMARY KEY NOT NULL,
  "token"         text NOT NULL,
  "kind"          text NOT NULL,
  "context_type"  text NOT NULL,
  "context_id"    integer NOT NULL,
  "contact_id"    integer,
  "account_id"    integer,
  "sent_to"       text,
  "lang"          text,
  "status"        text NOT NULL DEFAULT 'pending',
  "payload"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "submissions"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  "audit_trail"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expires_at"    timestamp with time zone,
  "viewed_at"     timestamp with time zone,
  "completed_at"  timestamp with time zone,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_access_links_token_unique" UNIQUE("token")
);

CREATE INDEX IF NOT EXISTS "idx_tenant_links_context" ON "tenant_access_links" ("kind","context_type","context_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_links_status"  ON "tenant_access_links" ("status","updated_at");
