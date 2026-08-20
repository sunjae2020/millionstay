-- 작업 지시서 사진 회차(세션)
--
-- 사진은 before/after 로만 나뉘어 있어 재방문 기록이 한 덩어리로 섞였다.
-- 업로드 한 묶음 = 한 세션으로 보고, (work_order_id, kind) 안에서 1부터 매긴다.
-- 기존 사진은 모두 1차로 본다(default 1).

ALTER TABLE work_order_photos
  ADD COLUMN IF NOT EXISTS session_no integer NOT NULL DEFAULT 1;

-- 회차 조회는 항상 (작업지시서, 전/후, 회차) 순서로 훑는다.
CREATE INDEX IF NOT EXISTS work_order_photos_session_idx
  ON work_order_photos (work_order_id, kind, session_no);
