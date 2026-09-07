-- 문자로 보낸 문서의 열람 링크 원장. 문자에는 파일을 실을 수 없어 짧은 링크가
-- 첨부를 대신한다 — 파일은 비공개 Cloudinary, 링크를 열면 서버가 짧은 서명 URL 로
-- 넘긴다. 만료·회수는 이 표에서 한다. 문서 종류를 가리지 않는다.
CREATE TABLE IF NOT EXISTS document_share_links (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  cloudinary_public_id text NOT NULL,
  resource_type text NOT NULL DEFAULT 'image',
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  label text,
  ref text,
  entity_type text,
  entity_id integer,
  sent_to text,
  recipient_name text,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_share_links_entity ON document_share_links (entity_type, entity_id);
