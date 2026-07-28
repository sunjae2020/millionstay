-- Additive: business-card fields on contacts.
-- Populated manually or by the AI business-card OCR (Contact detail → 명함).
-- NOTE: `contacts.title` is the honorific (Mr/Ms); `job_title` is the role
-- printed on the card, so the two are deliberately separate columns.
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "company_name" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "job_title" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "department" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "website" text;

-- Business-card images themselves are NOT stored here: they are personal
-- information, so they go to Cloudinary `authenticated` storage and are indexed
-- in the existing `documents` table as
--   entity_type = 'Contact', doc_type = 'business_card_front' | 'business_card_back'
-- which gives them retention dates + the central purge job for free.
-- The (public) profile photo keeps using contacts.profile_photo_url.
