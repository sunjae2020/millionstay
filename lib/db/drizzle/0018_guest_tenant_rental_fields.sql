-- 0018 — Reform the guest/tenant portal from homestay/international-student to
-- Korean short-term (단기) / long-term (장기) stay. Adds rental-oriented profile
-- fields to guest_users. The former study fields (university/department/
-- student_id/study_year) and bank_bsb stay in place for data retention but are
-- no longer surfaced in the portal UI.
-- Additive only.

ALTER TABLE guest_users ADD COLUMN IF NOT EXISTS company text;           -- 직장 / 소속
ALTER TABLE guest_users ADD COLUMN IF NOT EXISTS job_title text;         -- 직책
ALTER TABLE guest_users ADD COLUMN IF NOT EXISTS stay_purpose text;      -- 체류 목적 (travel/business/residence/study/other)
ALTER TABLE guest_users ADD COLUMN IF NOT EXISTS vehicle_plate text;     -- 차량 번호
ALTER TABLE guest_users ADD COLUMN IF NOT EXISTS parking_required boolean; -- 주차 필요 여부
