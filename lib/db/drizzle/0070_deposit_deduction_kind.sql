-- 퇴거 세대 정산 확인서 — 정산 내역 라인의 "구분" 칸
--
-- 종이 서식 2번 표는 항목마다 차감(−)/환급(+)을 명시한다. 지금까지는 금액 부호
-- (음수 = 환급)만으로 그 구분을 표현했는데, 표준 서식 뼈대와 견적 전 하자 라인은
-- 0원으로 깔리므로 부호가 없어 의도를 남길 자리가 없었다.
--
-- 금액 부호는 여전히 합계(A)의 정본이고, kind 는 그 부호를 문장으로 적어 둔 것이다.
-- 금액이 0이 아니면 부호에서 kind 를 되읽을 수 있으므로 기존 행은 default 로 충분하다.
--
-- Additive-only. 2026-08-27 두 인스턴스(MillionStay·Metheim)에 적용 완료.
ALTER TABLE "deposit_deduction_items" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'deduct';

-- 기존 음수 라인(환급)은 부호가 정본이므로 kind 를 맞춰 둔다.
UPDATE "deposit_deduction_items" SET "kind" = 'refund' WHERE "amount"::numeric < 0 AND "kind" <> 'refund';
