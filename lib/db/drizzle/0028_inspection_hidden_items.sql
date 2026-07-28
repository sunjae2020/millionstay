-- 0028 — 세대점검표: per-item hiding + one checklist per contract.
--
-- `hidden` lets an unneeded row drop out of the online checklist, the tenant
-- view and the PDF (e.g. 월패드 in a building without home network, or the
-- B/C-type-only 이동식 식탁 on an A-type unit). Template-level defaults live in
-- integration_settings (key = 'inspection_template_prefs'); this column carries
-- the per-contract override.
ALTER TABLE condition_report_items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- A lease has exactly one checklist. Enforced in the DB so a double-submit or a
-- second admin tab can never fork a contract's inspection history.
CREATE UNIQUE INDEX IF NOT EXISTS condition_reports_one_per_contract
  ON condition_reports (contract_id)
  WHERE contract_id IS NOT NULL AND deleted_at IS NULL;
