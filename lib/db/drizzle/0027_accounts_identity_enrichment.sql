-- Accounts: brand identity + Korean company registration + field provenance.
--
-- Backs the account detail/new page work:
--   · logo_url            — Cloudinary logo (uploaded or pulled from the website)
--   · biz_registration_no — 사업자등록번호, verified against the NTS status API
--   · biz_verify_status   — Valid | Closed | Suspended | NotFound (last result)
--   · biz_verified_at     — when that check ran
--   · ceo_name            — 대표자
--   · field_sources       — { "<column>": "manual" | "contact" | "crawl" }
--
-- Additive only; every column is nullable so existing rows are untouched.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS biz_registration_no text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS biz_verify_status text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS biz_verified_at timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ceo_name text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS field_sources jsonb;
