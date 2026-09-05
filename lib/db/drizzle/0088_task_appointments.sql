-- 업무(tasks)에 "언제 몇 시에" 를 더한다 — 방문 예약을 담기 위한 최소한의 확장.
--
-- 리드 상담 단계의 방문 예약은 새 표가 아니라 여기 앉는다. 업무는 이미 담당자·
-- 연락처·계정·상태·우선순위를 갖고 있고 캘린더가 읽는 소스이기도 하다. 새 표를
-- 만들면 그 넷을 전부 다시 만들어야 하고, 캘린더는 소스가 하나 더 늘어난다.
--
-- 기존 `due_date` 는 날짜뿐이라 "10월 2일 오후 3시" 를 담지 못한다. 시각이 있는
-- 일정만 아래 두 칸을 채우고, 마감일만 있는 업무는 지금까지대로 due_date 를 쓴다.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_end_at   timestamptz;
-- 어느 문의에서 잡힌 방문인지. 계약 전 단계라 booking_id 로는 가리킬 수 없다.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lead_id  integer;
-- 보러 가는 세대. 아직 안 정해진 방문도 있으므로 nullable.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS space_id integer;
-- 만나는 장소. 세대가 정해지지 않았거나 사무실에서 만나는 경우가 실제로 있다.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location text;
-- 담당자. 업무에는 지금까지 담당자 칸이 아예 없었다 — 연락처 슬롯 두 개는
-- "누구에 관한 업무인가" 이지 "누가 하는가" 가 아니다. leads.assigned_to 와 같은
-- 자유 텍스트로 둔다(직원 계정과 묶는 것은 그쪽이 정리된 뒤에).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to text;

CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks (lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks (scheduled_start_at);
