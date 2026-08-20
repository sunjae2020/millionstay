-- 작업 지시서 카테고리 표기 통일 (데이터 정리, DDL 없음)
--
-- category 는 오랫동안 자유 입력이라 같은 뜻이 언어·대소문자별로 흩어졌다
-- (Cleaning / cleaning / 청소, Plumbing / plumbing …). 분류표 정본은
-- lib/api-zod/src/workOrderCategories.ts 이고, 저장값을 그 canonical 값으로 맞춘다.
-- 멱등 — 이미 표준값인 행은 UPDATE 대상에서 빠진다.

-- 1) 빈 문자열은 미분류(NULL)로.
UPDATE work_orders SET category = NULL WHERE btrim(coalesce(category, '')) = '';

-- 2) 옛 표기 → 표준값. 분류표에 없는 값은 소문자·trim 만 맞추고 원문을 남긴다.
WITH alias(raw, canonical) AS (
  VALUES
    ('하자보수', 'repair'), ('유지보수', 'repair'), ('maintenance', 'repair'),
    ('퇴거청소', 'move_out_cleaning'), ('move out cleaning', 'move_out_cleaning'),
    ('입주청소', 'move_in_cleaning'), ('move in cleaning', 'move_in_cleaning'),
    ('청소', 'cleaning'),
    ('배관', 'plumbing'),
    ('전기', 'electrical'),
    ('냉난방', 'hvac'), ('냉난방공조', 'hvac'),
    ('도장', 'painting'),
    ('목공', 'carpentry'),
    ('방역', 'pest_control'), ('pest control', 'pest_control'),
    ('조경', 'landscaping'),
    ('보안', 'security'),
    ('데이투어', 'day_tour'), ('day tour', 'day_tour'),
    ('낚시', 'fishing'),
    ('일반', 'general'), ('기타', 'general'), ('other', 'general')
)
UPDATE work_orders w
   SET category = coalesce(
         (SELECT a.canonical FROM alias a WHERE a.raw = lower(btrim(w.category))),
         lower(btrim(w.category)))
 WHERE w.category IS NOT NULL
   AND w.category IS DISTINCT FROM coalesce(
         (SELECT a.canonical FROM alias a WHERE a.raw = lower(btrim(w.category))),
         lower(btrim(w.category)));
