-- 0061 — 퇴거 정산 확인서의 "비고 및 처리 안내" 열.
--
-- The 2026 move-out settlement form prints a remark per settlement line
-- ("당월 관리비 미납분 차감", "가스회사 해지 신청 후 별도 납부 예정" …). Until now the
-- line only carried description + amount, so the column rendered blank on real
-- data. Additive, nullable — existing rows keep printing an empty remark.
ALTER TABLE deposit_deduction_items ADD COLUMN IF NOT EXISTS remark text;
