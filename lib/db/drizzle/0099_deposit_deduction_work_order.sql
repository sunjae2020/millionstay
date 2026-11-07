-- 0099 보증금 정산 차감 라인에 작업지시 연결 칸을 더한다
--
-- 작업지시(work_orders)에는 임차인 부담(charged_to='tenant') + 보증금 차감
-- (settlement_method='deposit_deduction')을 표시할 수 있었지만, 퇴거 정산서는 그
-- 표시를 읽지 않아 차감 라인이 생기지 않았다. 정산서를 만들 때 해당 작업지시를
-- 차감 라인으로 깔고, 라인이 어느 작업지시에서 왔는지 이 칸에 남긴다.
--
-- 이 연결로 (1) 같은 작업지시가 두 정산서에 두 번 차감되는 것을 막고,
-- (2) 정산 확정 시 연결된 작업지시의 수령일자(settled_on)를 채운다.
--
-- 기존 라인은 NULL(연결 없음) 그대로 — 백필 없음.
-- Metheim 운영 DB 에는 이 칸이 이미 있다(IF NOT EXISTS 로 무해하게 재실행된다).

ALTER TABLE deposit_deduction_items ADD COLUMN IF NOT EXISTS work_order_id integer;

CREATE INDEX IF NOT EXISTS deposit_deduction_items_work_order_idx
  ON deposit_deduction_items (work_order_id);
