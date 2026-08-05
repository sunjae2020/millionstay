-- 0044 — 마케팅 · 이메일 캠페인 (marketing / email campaigns)
--
-- Outbound partner-development module: cold prospect ledger, lists, drip
-- campaigns, a send queue, an append-only event ledger and a bounce/complaint
-- block list. See docs/proposals/MARKETING_CAMPAIGN_MODULE.md.
--
-- Nothing existing is touched. Unsubscribe consent stays in marketing_consents
-- (its public endpoint already writes it); email_suppressions here covers only
-- what consent cannot express — dead addresses and spam complaints.
--
-- Additive only. Safe to re-run.

-- ── M1. 리스트 / 세그먼트 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_lists (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  list_type        text NOT NULL DEFAULT 'static',   -- 'static' | 'dynamic'
  filter_criteria  jsonb,
  member_count     integer NOT NULL DEFAULT 0,
  owner_user_id    integer,
  status           text NOT NULL DEFAULT 'Active',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_lists_status ON marketing_lists (status);

-- ── M2. 콜드 거래처 원장 ─────────────────────────────────────────────────────
-- consent_basis: 'express' | 'inferred_b2b' | 'existing' | 'none'
-- The send worker refuses anything but a recorded basis; 'none' is never mailed.
CREATE TABLE IF NOT EXISTS prospects (
  id                   serial PRIMARY KEY,
  company_name         text NOT NULL,
  email                text NOT NULL,
  contact_name         text NOT NULL DEFAULT '',
  contact_title        text NOT NULL DEFAULT '',
  phone                text NOT NULL DEFAULT '',
  website              text NOT NULL DEFAULT '',
  segment              text NOT NULL DEFAULT '',
  country              text NOT NULL DEFAULT '',
  city                 text NOT NULL DEFAULT '',
  source               text NOT NULL DEFAULT 'manual',
  source_detail        text NOT NULL DEFAULT '',
  prospect_status      text NOT NULL DEFAULT 'new',
  qualification_score  integer NOT NULL DEFAULT 0,
  owner_user_id        integer,
  language_code        text NOT NULL DEFAULT 'ko',
  consent_basis        text NOT NULL DEFAULT 'none',
  consent_evidence     text NOT NULL DEFAULT '',
  consent_recorded_at  timestamptz,
  bounce_count         integer NOT NULL DEFAULT 0,
  last_contacted_at    timestamptz,
  next_action_at       timestamptz,
  converted_account_id integer,
  converted_contact_id integer,
  converted_at         timestamptz,
  disqualified_reason  text NOT NULL DEFAULT '',
  notes                text NOT NULL DEFAULT '',
  status               text NOT NULL DEFAULT 'Active',
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
-- One live prospect per address; a soft-deleted row frees the address for re-import.
CREATE UNIQUE INDEX IF NOT EXISTS uq_prospects_email_live
  ON prospects (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_status  ON prospects (prospect_status);
CREATE INDEX IF NOT EXISTS idx_prospects_segment ON prospects (segment);
CREATE INDEX IF NOT EXISTS idx_prospects_owner   ON prospects (owner_user_id);

-- ── M3. 리스트 멤버십 (static 전용) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospect_list_members (
  id               serial PRIMARY KEY,
  list_id          integer NOT NULL,
  prospect_id      integer NOT NULL,
  added_by_user_id integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prospect_list_members
  ON prospect_list_members (list_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_list_members_prospect
  ON prospect_list_members (prospect_id);

-- ── M4. 캠페인 마스터 ────────────────────────────────────────────────────────
-- send_window_* + timezone enforce Korean quiet hours (광고성 정보 21:00–08:00 금지);
-- is_advertising drives the "(광고)" subject prefix and the opt-out notice.
CREATE TABLE IF NOT EXISTS email_campaigns (
  id                  serial PRIMARY KEY,
  name                text NOT NULL,
  description         text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'draft',
  list_id             integer,
  from_email          text NOT NULL DEFAULT '',
  from_name           text NOT NULL DEFAULT '',
  reply_to            text NOT NULL DEFAULT '',
  language_code       text NOT NULL DEFAULT 'ko',
  is_advertising      boolean NOT NULL DEFAULT true,
  throttle_per_hour   integer NOT NULL DEFAULT 60,
  send_window_start   text NOT NULL DEFAULT '09:00',
  send_window_end     text NOT NULL DEFAULT '18:00',
  timezone            text NOT NULL DEFAULT 'Asia/Seoul',
  scheduled_at        timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  total_recipients    integer NOT NULL DEFAULT 0,
  sent_count          integer NOT NULL DEFAULT 0,
  delivered_count     integer NOT NULL DEFAULT 0,
  opened_count        integer NOT NULL DEFAULT 0,
  clicked_count       integer NOT NULL DEFAULT 0,
  replied_count       integer NOT NULL DEFAULT 0,
  bounced_count       integer NOT NULL DEFAULT 0,
  unsubscribed_count  integer NOT NULL DEFAULT 0,
  converted_count     integer NOT NULL DEFAULT 0,
  created_by_user_id  integer,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns (status);

-- ── M5. 드립 시퀀스 단계 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_steps (
  id            serial PRIMARY KEY,
  campaign_id   integer NOT NULL,
  step_no       integer NOT NULL DEFAULT 1,
  name          text NOT NULL DEFAULT '',
  template_code text,                                -- email_template.template_code
  subject       text NOT NULL DEFAULT '',
  body_html     text NOT NULL DEFAULT '',
  body_i18n     jsonb,                               -- { "<lang>": { subject, body_html } }
  delay_days    integer NOT NULL DEFAULT 0,
  delay_hours   integer NOT NULL DEFAULT 0,
  stop_on       text NOT NULL DEFAULT 'reply',       -- 'none' | 'open' | 'click' | 'reply'
  status        text NOT NULL DEFAULT 'Active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_steps_no
  ON campaign_steps (campaign_id, step_no);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps (campaign_id);

-- ── M6. 수신자 + 발송 큐 ─────────────────────────────────────────────────────
-- Claimed with FOR UPDATE SKIP LOCKED so overlapping cron ticks cannot double-send.
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id               serial PRIMARY KEY,
  campaign_id      integer NOT NULL,
  prospect_id      integer NOT NULL,
  email            text NOT NULL,
  recipient_status text NOT NULL DEFAULT 'pending',
  current_step     integer NOT NULL DEFAULT 1,
  next_send_at     timestamptz,
  last_sent_at     timestamptz,
  opened_at        timestamptz,
  clicked_at       timestamptz,
  replied_at       timestamptz,
  open_count       integer NOT NULL DEFAULT 0,
  click_count      integer NOT NULL DEFAULT 0,
  skip_reason      text NOT NULL DEFAULT '',
  error_message    text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients
  ON campaign_recipients (campaign_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_queue
  ON campaign_recipients (recipient_status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_prospect
  ON campaign_recipients (prospect_id);

-- ── M7. 발송 기록 (중복 차단) ────────────────────────────────────────────────
-- Inserted BEFORE the provider call, so a crash or retry collides on the UNIQUE
-- constraint instead of mailing the same person twice.
CREATE TABLE IF NOT EXISTS campaign_sends (
  id                  serial PRIMARY KEY,
  campaign_id         integer NOT NULL,
  step_id             integer NOT NULL,
  recipient_id        integer NOT NULL,
  prospect_id         integer NOT NULL,
  email               text NOT NULL,
  subject             text NOT NULL DEFAULT '',
  send_status         text NOT NULL DEFAULT 'claimed',
  provider_message_id text,
  error_message       text NOT NULL DEFAULT '',
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_sends
  ON campaign_sends (campaign_id, step_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_provider_msg
  ON campaign_sends (provider_message_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends (campaign_id);

-- ── M8. 이벤트 원장 (append-only) ────────────────────────────────────────────
-- NEVER UPDATE OR DELETE. Evidentiary record behind every statistic and every
-- consent decision. provider_event_id is UNIQUE so webhook replays are idempotent.
CREATE TABLE IF NOT EXISTS campaign_events (
  id                  serial PRIMARY KEY,
  campaign_id         integer,
  step_id             integer,
  recipient_id        integer,
  prospect_id         integer,
  send_id             integer,
  email               text NOT NULL DEFAULT '',
  event_type          text NOT NULL,
  provider_event_id   text,
  provider_message_id text,
  detail              text NOT NULL DEFAULT '',
  raw_payload         jsonb,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_events_provider_event
  ON campaign_events (provider_event_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign
  ON campaign_events (campaign_id, event_type);
CREATE INDEX IF NOT EXISTS idx_campaign_events_prospect ON campaign_events (prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_message
  ON campaign_events (provider_message_id);

-- ── M9. 바운스 / 불만 차단 목록 ──────────────────────────────────────────────
-- Unsubscribes live in marketing_consents, not here. Both must be checked.
CREATE TABLE IF NOT EXISTS email_suppressions (
  id                 serial PRIMARY KEY,
  email              text NOT NULL,
  reason             text NOT NULL,          -- 'hard_bounce' | 'complaint' | 'manual'
  detail             text NOT NULL DEFAULT '',
  source_campaign_id integer,
  created_by_user_id integer,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_suppressions_email
  ON email_suppressions (lower(email));
