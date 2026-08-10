-- 고객 ID 채번 — [접두사2][YYMM][유형1][일련3] (MH2607C001).
-- 추가만 한다. 기존 레코드는 백필 스크립트(scripts/backfill-party-codes.mjs)가
-- 최초 등록 연월 순서대로 번호를 매긴다.
CREATE TABLE IF NOT EXISTS party_codes (
  id           serial PRIMARY KEY,
  entity_type  varchar(32) NOT NULL,
  entity_id    integer     NOT NULL,
  code         varchar(16) NOT NULL,
  prefix       varchar(4)  NOT NULL,
  period       varchar(4)  NOT NULL,
  party_type   varchar(1)  NOT NULL,
  seq          integer     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_codes_entity
  ON party_codes (entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_codes_code
  ON party_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_codes_run
  ON party_codes (prefix, period, party_type, seq);
CREATE INDEX IF NOT EXISTS idx_party_codes_entity_id
  ON party_codes (entity_id);
