-- 0098 청구서 선납 커버 구간 — 월세 자동 생성기 중복 방지
--
-- 여러 달을 한 장으로 받은 청구서는 due_date 가 첫 달에만 있어서, 자동 생성기가
-- 둘째·셋째 달을 "미청구"로 보고 또 만들었다(1815호 사례: 3개월 선납 뒤에
-- RENT-434-202607/202608 이 미납 채권으로 쌓임). billing_period ~ billing_period_end
-- ("YYYY-MM", 양끝 포함) 구간을 적어 두면 생성기가 그 달들을 건너뛴다.
-- 비어 있으면 billing_period 한 달만 덮는다.
--
-- 운영 Metheim DB 에는 이 컬럼이 이미 있다(옛 브랜치의 0063 으로 수동 적용됨).
-- IF NOT EXISTS 라 다시 돌려도 무해하다. Additive-only.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_end text;
