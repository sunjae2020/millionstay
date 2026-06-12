-- Homestay host application: WWCC/insurance compliance + post-approval bank details.
-- Idempotent / additive — safe to re-run.

ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "wwcc_records" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "insurance_provider" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "insurance_policy_no" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "insurance_expiry" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "bank_name" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "bank_account_name" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "bank_bsb" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "bank_account_number" text;
ALTER TABLE "homestay_host_applications" ADD COLUMN IF NOT EXISTS "bank_swift" text;
