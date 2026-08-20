-- 청구서 줄 → 작업지시 역참조 (하자·청소 청구 명세서에서 발행되는 청구서)
--
-- 한 장의 명세서에 작업지시가 여러 건 실리므로 invoices.work_order_id(1:1)로는
-- 어느 줄이 어느 작업에서 나왔는지 표현할 수 없다. 줄 단위로 남겨야 같은
-- 작업지시가 두 번 청구되는 것을 막고, 청구서에서 작업 사진까지 되짚을 수 있다.
--
-- 추가만 한다(nullable). 기존 줄은 NULL 로 남고 동작이 달라지지 않는다.
-- 롤백: ALTER TABLE invoice_line_items DROP COLUMN work_order_id;

ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS work_order_id integer;

-- 같은 작업지시가 살아 있는 청구서에 두 번 실리지 않게 하는 조회용 인덱스.
CREATE INDEX IF NOT EXISTS invoice_line_items_work_order_id_idx
  ON invoice_line_items (work_order_id)
  WHERE work_order_id IS NOT NULL;
