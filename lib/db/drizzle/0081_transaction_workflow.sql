-- 거래 승인 워크플로 (maker-checker)
--
-- 지금은 입력한 사람이 그대로 전기까지 할 수 있다. 돈이 나가는 지출에서 그건
-- 위험하다 — 만든 사람과 승인하는 사람이 갈라져야 오입금·중복지급이 걸린다.
--
--   draft → submitted → posted → confirmed → paid   (+ rejected | void)
--
-- 기존 status 컬럼(draft/confirmed/posted/void)은 **그대로 둔다.** 이미 배포돼
-- 결제 일정 집계가 그 값을 읽고 있어서, 여기에 단계를 더 밀어넣으면 "확정"의
-- 뜻이 바뀌어 미납 계산이 흔들린다. 승인 단계는 별도 컬럼으로 나란히 간다.
-- 레거시 행(workflow_status IS NULL)은 draft 로 읽는다.
--
-- Additive-only.

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "workflow_status" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "submitted_by" integer;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "submitted_at" timestamptz;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "rejected_by" integer;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "rejected_at" timestamptz;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "paid_at" timestamptz;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "paid_by" integer;
-- 담당 직원 — 지출을 요청한 사람. 승인자가 "누구 건인지" 없이 판단할 수는 없다.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "owner_user_id" integer;

CREATE INDEX IF NOT EXISTS "transactions_workflow_idx" ON "transactions" ("workflow_status");
