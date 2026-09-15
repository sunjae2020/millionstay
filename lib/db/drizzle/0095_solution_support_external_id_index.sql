-- 0095 솔루션 지원 — external_message_id 유니크 인덱스에서 부분 조건을 뺀다
--
-- 0094 는 `WHERE external_message_id IS NOT NULL` 부분 유니크 인덱스를 만들었다.
-- 의도는 맞았지만 Postgres 의 `ON CONFLICT (external_message_id)` 는 **부분** 인덱스를
-- 추론하지 못한다. 추론시키려면 ON CONFLICT 절에 인덱스 술어를 똑같이 적어야 하고,
-- 안 적으면 이렇게 터진다:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- 실제로 회신 수신 크론이 5분마다 이 오류로 죽어 공급사 답변이 하나도 들어오지 않았다.
--
-- 술어를 지우는 쪽이 옳다. Postgres 는 유니크 인덱스에서 NULL 을 서로 다른 값으로
-- 보므로(기본 NULLS DISTINCT), 조건 없는 유니크 인덱스도 "우리가 쓴 글(NULL)은 몇 줄이든
-- 허용, 공급사 메시지 id 는 한 번만" 을 그대로 만족한다. 부분 조건은 얻는 것 없이
-- ON CONFLICT 추론만 막고 있었다.

DROP INDEX IF EXISTS solution_support_messages_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS solution_support_messages_external_id_key
  ON solution_support_messages (external_message_id);
