-- 0093 솔루션 지원(Solution Support) — 우리 직원이 솔루션 공급사(Edubee)에 보내는 문의함
--
-- cs_tickets 의 거울상이다. cs_tickets 는 "우리 고객 → 우리", 이 표는 "우리 → 공급사".
-- 티켓은 먼저 여기에 저장하고(공급사가 죽어 있어도 기록이 남는다) 그 다음 공급사
-- 연합 수신부 POST /api/platform-support/ingest 로 밀어 넣는다. ticket_ref 를
-- external_ref 로 보내므로 같은 티켓을 다시 밀면 중복 생성이 아니라 스레드에
-- 메시지가 덧붙는다.
--
-- 추가 전용(additive) — 기존 표를 건드리지 않는다.

CREATE TABLE IF NOT EXISTS solution_support_tickets (
  id                 serial PRIMARY KEY,
  ticket_ref         text NOT NULL UNIQUE,
  category           text NOT NULL DEFAULT 'usage',
  subject            text NOT NULL,
  description        text NOT NULL,
  status             text NOT NULL DEFAULT 'open',
  priority           text NOT NULL DEFAULT 'normal',
  language           text NOT NULL DEFAULT 'ko',
  links              jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_summary         text,
  requester_admin_id integer,
  requester_name     text,
  requester_email    text,
  external_ticket_id text,
  -- queued → 아직 공급사가 받지 않음, sent → 접수됨, failed → push_error 참조
  push_status        text NOT NULL DEFAULT 'queued',
  push_error         text,
  pushed_at          timestamptz,
  closed_at          timestamptz,
  deleted_at         timestamp,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solution_support_tickets_status_idx
  ON solution_support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS solution_support_tickets_push_idx
  ON solution_support_tickets (push_status);

CREATE TABLE IF NOT EXISTS solution_support_messages (
  id          serial PRIMARY KEY,
  ticket_id   integer NOT NULL REFERENCES solution_support_tickets(id) ON DELETE CASCADE,
  -- admin → 여기서 작성해 공급사로 발송, solution → 공급사 답신을 직원이 기록
  sender_type text NOT NULL DEFAULT 'admin',
  sender_id   integer,
  sender_name text,
  message     text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  push_status text NOT NULL DEFAULT 'queued',
  push_error  text,
  pushed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solution_support_messages_ticket_idx
  ON solution_support_messages (ticket_id, created_at);
