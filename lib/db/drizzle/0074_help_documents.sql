-- 내부 문서함 — 운영 지도·정책 문서·세입자 링크 목록 (직원 교육용)
--
-- 파일을 담지 않고 가리키기만 한다. 발행 서류의 실물은 documents 가, AI 자료는
-- knowledge_documents 가 이미 갖고 있어서, 여기에 파일을 또 두면 같은 문서가
-- 세 곳에서 각자 낡는다.
--
-- 신규 테이블이라 기존 데이터에 영향 없음(additive-only).
-- 롤백: DROP TABLE "help_documents";
CREATE TABLE IF NOT EXISTS "help_documents" (
  "id"            serial PRIMARY KEY NOT NULL,
  "title"         text NOT NULL,
  "description"   text,
  "category"      text NOT NULL DEFAULT '운영 가이드',
  "audience"      text NOT NULL DEFAULT 'staff',
  "url"           text,
  "route_pattern" text,
  "issue_hint"    text,
  "tags"          jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sort_order"    integer NOT NULL DEFAULT 100,
  "status"        text NOT NULL DEFAULT 'active',
  "created_by"    integer,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_help_documents_category"
  ON "help_documents" ("status","category","sort_order");
