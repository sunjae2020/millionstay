-- Settings → Users: profile / HR / emergency-contact fields on admin_users.
-- Additive only; every column is nullable so existing rows stay valid.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "date_of_birth" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "postcode" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "address_line1" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "address_detail" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "profile_photo_url" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "business_card_front_id" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "business_card_back_id" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "department" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "job_title" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "employee_no" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "joined_on" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "emergency_contact_name" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "emergency_contact_relation" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "locale" text;
