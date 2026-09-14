-- 0094 솔루션 지원 — 공급사 답변 수신(회신 경로)
--
-- 지금까지 연동은 한 방향이었다. 우리 문의는 Edubee 수신부로 밀려 들어갔지만,
-- 공급사가 단 답변은 돌아올 길이 없어 직원이 메일을 보고 손으로 옮겨 적어야 했다.
-- Edubee 가 `GET /platform-support/outbox` (같은 토큰, keyset 커서)를 열었으므로
-- 우리 쪽은 그것을 주기적으로 당겨와 스레드에 넣는다.
--
-- 중복 삽입을 막는 유일한 방어선이 `external_message_id` 다. 커서를 잃어버리거나
-- (재배포·수동 초기화) 같은 페이지를 두 번 받아도 같은 답변이 두 줄로 남지 않는다.
--
-- 추가 전용(additive).

ALTER TABLE solution_support_messages
  ADD COLUMN IF NOT EXISTS external_message_id text;

-- 공급사 메시지 1건 = 우리 메시지 1행. NULL(우리가 쓴 글)은 제약을 받지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS solution_support_messages_external_id_key
  ON solution_support_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;
