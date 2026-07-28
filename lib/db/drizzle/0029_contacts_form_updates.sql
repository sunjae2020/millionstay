-- Additive: contact form fields requested for the Korean market.
--
--  sns_type          — which messenger the sns_id belongs to (카카오톡 / LINE / …).
--                      The id alone is ambiguous; staff could not tell a Kakao ID
--                      from a WeChat one.
--  is_foreigner      — the passport/visa block is only relevant for foreign
--                      nationals, so it is collapsed behind this toggle instead
--                      of sitting empty on every domestic contact.
--  emergency_contact_* — next of kin for the tenant, kept on the contact itself
--                      (guest-portal users have their own table).
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "sns_type" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "is_foreigner" boolean NOT NULL DEFAULT false;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "emergency_contact_name" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "emergency_contact_email" text;

-- Existing rows that already carry passport or visa details are foreign
-- nationals by definition — keep that block visible for them.
UPDATE "contacts"
   SET "is_foreigner" = true
 WHERE "is_foreigner" = false
   AND (
     COALESCE("passport_number", '') <> ''
     OR COALESCE("visa_type", '') <> ''
     OR COALESCE("visa_expiry", '') <> ''
   );
