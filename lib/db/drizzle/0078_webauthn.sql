-- 패스키(WebAuthn) 로그인 — 관리자·파트너·게스트 공용 자격증명 저장소
--
-- 비밀번호를 대체하는 것이 아니라 추가한다. 기존 로그인은 그대로 두고, 같은
-- 계정에 기기별 패스키를 여러 개 등록할 수 있다. user_type + user_id 로
-- users / partner_users / guest_users 를 함께 담는다 — 자격증명의 모양이
-- 셋 다 동일해서 테이블을 쪼갤 이유가 없다.
--
-- challenges 는 인스턴스가 여러 개라 메모리에 둘 수 없다. 발급한 인스턴스와
-- 검증하는 인스턴스가 다를 수 있으므로 DB에 5분짜리로 쌓고 만료분은 지운다.
--
-- Additive-only.

CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
  "id" serial PRIMARY KEY,
  "user_type" text NOT NULL,
  "user_id" integer NOT NULL,
  "credential_id" text NOT NULL,
  "public_key" text NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "transports" text,
  "device_type" text,
  "backed_up" boolean NOT NULL DEFAULT false,
  "rp_id" text NOT NULL,
  "device_name" text,
  "last_used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "webauthn_credentials_credential_id_key"
  ON "webauthn_credentials" ("credential_id");
CREATE INDEX IF NOT EXISTS "webauthn_credentials_owner_idx"
  ON "webauthn_credentials" ("user_type", "user_id");

CREATE TABLE IF NOT EXISTS "webauthn_challenges" (
  "id" serial PRIMARY KEY,
  "challenge" text NOT NULL,
  "purpose" text NOT NULL,
  "user_type" text NOT NULL,
  "user_id" integer,
  "rp_id" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "webauthn_challenges_expires_idx"
  ON "webauthn_challenges" ("expires_at");
