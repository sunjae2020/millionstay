-- 청구서 입금 계좌: 인보이스가 어느 계좌로 받을지 가리킨다(`payment_info.id`).
-- NULL이면 문서 렌더 시 활성 계좌 중 기본값(계좌이체 첫 행)으로 안내되므로
-- 기존 인보이스도 별도 백필 없이 계좌가 표시된다.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_info_id integer;
