-- Manual migration: incremental recurring-billing opt-in for regular contracts.
-- Additive, nullable. NULL (default) = legacy behaviour where /v1/contracts/:id/activate
-- pre-generates every invoice for the whole term up front. 'incremental' = the
-- recurring-invoice cron generates one invoice per cycle as next_due_date falls
-- due. The cron only ever picks up 'incremental' rows, so existing pre-generated
-- contracts are never double-billed.
ALTER TABLE recurring_schedule
  ADD COLUMN IF NOT EXISTS billing_mode text;
