-- Approval gate for recurring schedules: auto-created schedules start
-- 'PendingApproval' and are only billed by the cron once an admin approves.
-- Existing/manual schedules default to 'Approved' (no behaviour change).
-- Idempotent / additive — safe to re-run.

ALTER TABLE "recurring_schedule"
  ADD COLUMN IF NOT EXISTS "approval_status" text NOT NULL DEFAULT 'Approved';

CREATE INDEX IF NOT EXISTS "idx_recurring_approval_status"
  ON "recurring_schedule" ("approval_status");
