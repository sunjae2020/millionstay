-- 0040: document_templates.category 를 수신자 그룹 slug 로 정규화
--
-- 배경: category 컬럼에 화면 표시용 문자열이 그대로 저장돼 시드마다 값이 갈렸다.
--   base 시드      → 'Documents' / 'Homestay'   (영문 표시명)
--   Metheim 시드   → '문서'                      (한글 표시명)
-- 같은 뜻인데 값이 달라 그룹핑이 불가능하고, 로케일을 바꾸면 그룹 이름이 DB 값과
-- 어긋난다.
--
-- 정본 = docs/EMAIL_TEMPLATE_SPEC.md §2. category 는 **수신자 그룹**을 담는다
-- (업무 도메인은 key 의 <domain>. 접두사가 이미 담고 있다):
--   common    공통 — 계정/인증, 문서 커버 메일 (전 수신자 공용)
--   customer  고객·세입자 (B2C)
--   owner     소유주
--   partner   에이전트·학교·기업 (B2B)
--   host      서비스 호스트 (청소·기사·정비)
--   staff     내부 직원
--   marketing 마케팅 (수신동의 필요)
--
-- 화면 라벨은 admin i18n `documentTemplate.cat_<slug>` 가 담당한다.
-- 멱등: 이미 slug 인 행은 건드리지 않는다.

UPDATE document_templates
   SET category = CASE
     WHEN category IN ('Documents', '문서', 'Document', 'documents') THEN 'common'
     WHEN category IN ('Homestay', '홈스테이', 'homestay')           THEN 'customer'
     ELSE category
   END
 WHERE category IN ('Documents', '문서', 'Document', 'documents',
                    'Homestay', '홈스테이', 'homestay');

-- 미분류 행은 공통으로 모은다 (Studio 에서 "기타" 로 흩어지지 않게).
UPDATE document_templates
   SET category = 'common'
 WHERE category IS NULL OR btrim(category) = '';

-- 목록이 카테고리로 그룹핑되므로 조회 축에 인덱스를 둔다.
CREATE INDEX IF NOT EXISTS ix_document_templates_category
  ON document_templates (category);
