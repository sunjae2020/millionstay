-- 0024 — Unit inspection checklist (세대점검표) as a contract attachment.
--
-- Extends the existing condition_reports family instead of forking a new one, so
-- one system covers booking-phase evidence AND the Metheim lease 세대점검표
-- (cross-product policy). Additive only.

-- ── condition_reports ────────────────────────────────────────────────────────
ALTER TABLE condition_reports ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS contract_id integer;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS sign_token text;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS sign_token_phase text;
ALTER TABLE condition_reports ADD COLUMN IF NOT EXISTS sign_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS condition_reports_sign_token_key
  ON condition_reports (sign_token) WHERE sign_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS condition_reports_contract_id_idx
  ON condition_reports (contract_id) WHERE contract_id IS NOT NULL;

-- ── condition_report_items ───────────────────────────────────────────────────
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS item_code text;
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS move_in_status text;
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS move_in_note text;
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS move_out_status text;
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS move_out_note text;

-- ── condition_report_photos ──────────────────────────────────────────────────
ALTER TABLE condition_report_photos ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'move_in';

-- ── condition_report_signatures (new) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS condition_report_signatures (
  id serial PRIMARY KEY,
  condition_report_id integer NOT NULL,
  phase text NOT NULL,
  role text NOT NULL,
  signer_name text,
  signature_image text NOT NULL,
  content_hash text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS condition_report_signatures_report_idx
  ON condition_report_signatures (condition_report_id);
