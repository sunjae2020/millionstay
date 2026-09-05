-- 0085 사용자 활동 로그 (user_activity_log)
--
-- system_log 는 CUD(생성·수정·삭제)의 전·후 값을 남긴다. 값이 바뀌지 않는 행위
-- (로그인, 열람, 다운로드, 내보내기, AI/OCR 호출, 서류 발행)는 남길 데가 없어
-- "누가 오늘 무엇을 했나"를 볼 수 없었다. 이 테이블이 그 절반을 채우고,
-- 시스템 로그 화면이 두 테이블을 하나의 피드로 합쳐 보여 준다.
--
-- 추가 전용(additive-only). 기존 테이블은 건드리지 않는다.

CREATE TABLE IF NOT EXISTS "user_activity_log" (
  "id"            serial PRIMARY KEY,
  "actor_id"      integer,
  "actor_email"   text,
  "actor_role"    text,
  "branch_id"     integer,
  "team_id"       integer,
  "action"        text NOT NULL,
  "resource_type" text,
  "resource_id"   integer,
  "method"        text,
  "path"          text,
  "status_code"   integer,
  "duration_ms"   integer,
  "metadata"      jsonb,
  "ip_address"    text,
  "user_agent"    text,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_activity_actor_created" ON "user_activity_log" ("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_activity_action"        ON "user_activity_log" ("action");
CREATE INDEX IF NOT EXISTS "idx_activity_resource"      ON "user_activity_log" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "idx_activity_created"       ON "user_activity_log" ("created_at");

-- 합산 피드가 기간으로 먼저 자르므로 system_log 쪽 날짜 인덱스도 확인해 둔다.
CREATE INDEX IF NOT EXISTS "idx_syslog_created" ON "system_log" ("created_at");
