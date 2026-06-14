-- CS auto-translation: store each message in its original language plus AI
-- translations into { customer_language, en }, so the customer reads their own
-- language and the admin reads English.
--
-- Non-destructive: all columns are additive with defaults, so existing tickets
-- and messages backfill safely (customer_language = 'en', translations = {},
-- translation_status = 'skipped' → behaves exactly as today until enabled).

-- Ticket: the language the requester chose to converse in.
ALTER TABLE cs_tickets
  ADD COLUMN IF NOT EXISTS customer_language text NOT NULL DEFAULT 'en';

ALTER TABLE cs_tickets
  ADD COLUMN IF NOT EXISTS translation_enabled boolean NOT NULL DEFAULT true;

-- Message: original language + cached translations + status/usage.
ALTER TABLE cs_messages
  ADD COLUMN IF NOT EXISTS original_lang text;

ALTER TABLE cs_messages
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE cs_messages
  ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'skipped';

ALTER TABLE cs_messages
  ADD COLUMN IF NOT EXISTS translation_input_tokens integer;

ALTER TABLE cs_messages
  ADD COLUMN IF NOT EXISTS translation_output_tokens integer;
