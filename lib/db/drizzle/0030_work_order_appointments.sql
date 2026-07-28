-- 0030 — 방문 약속(인스펙션): work_orders becomes the appointment ledger.
--
-- 집 인스펙션(입주 전/퇴거/정기 점검)은 "언제·어디서·누가 만난다"가 핵심인데,
-- work_orders 에는 date-only text 컬럼 scheduled_at 밖에 없어 시간대·소요시간·
-- 내부 담당자·동석자·출입 방법을 담을 수 없었다. 아래 컬럼이 그 공백을 메운다.
-- 결과물(세대점검표)은 여전히 condition_reports 가 소유하고, 여기서 링크만 건다.
--
-- 기존 scheduled_at(text)은 호환을 위해 그대로 둔다 — 새 코드는 start/end 를 쓴다.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

-- 내부 직원 담당자(users.id). assigned_contact_id(외부 개인) 및
-- service_host_id(파트너 업체)와 별개.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_user_id integer;

-- 현장에서 만나는 사람(보통 세입자): contacts.id
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS attendee_contact_id integer;

-- 집결지/주차/출입 안내, 출입 방법
-- access_method: vacant_key | tenant_present | lockbox | agent | other
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS location_note text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS access_method text;

-- category='inspection' 일 때의 소분류
-- move_in | move_out | routine | pre_listing | defect_check
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS inspection_type text;

-- 이 방문이 만들어낸 세대점검표(condition_reports.id)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS condition_report_id integer;

-- 방문 확정 메일(.ics 첨부) 최종 발송 시각
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- 캘린더는 기간 조회가 지배적이다.
CREATE INDEX IF NOT EXISTS work_orders_scheduled_start_idx ON work_orders (scheduled_start_at);
CREATE INDEX IF NOT EXISTS work_orders_assigned_user_idx ON work_orders (assigned_user_id);
