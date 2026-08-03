-- 발행 문서 파일명 규칙: <코드3자리>-<이름>_<YYYYMMDD><순번>
-- 예) CTR-김용식_20260803A.pdf
--
-- 파일명은 문서마다 한 번만 할당하고 이후에는 읽기만 한다 (PDF는 미리보기·
-- 다운로드마다 다시 렌더되므로, 매번 새 순번을 뽑으면 같은 계약서가 A였다가
-- B가 되어 버린다).
CREATE TABLE IF NOT EXISTS document_file_names (
  id          serial PRIMARY KEY,
  doc_code    varchar(8)   NOT NULL,
  entity_type varchar(32)  NOT NULL,
  entity_id   integer      NOT NULL,
  variant     varchar(32)  NOT NULL DEFAULT '',
  party_key   varchar(128) NOT NULL,
  party_name  varchar(128) NOT NULL,
  issue_date  date         NOT NULL,
  seq         integer      NOT NULL,
  file_name   varchar(255) NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- 문서 1건 = 이름 1개 (재발행해도 같은 이름).
CREATE UNIQUE INDEX IF NOT EXISTS uq_docfilenames_entity
  ON document_file_names (entity_type, entity_id, doc_code, variant);

-- 같은 사람·같은 날짜에 같은 순번은 하나뿐 — 동시 발행 시 충돌한 쪽이 다음
-- 순번으로 재시도한다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_docfilenames_party_day_seq
  ON document_file_names (party_key, issue_date, seq);

CREATE INDEX IF NOT EXISTS idx_docfilenames_name
  ON document_file_names (file_name);
