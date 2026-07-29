-- =============================================================================
-- tenants/metheim/archive-owner-sample-properties.sql
--
-- Soft-deletes (archives) everything created by owner-sample-properties.seed.sql:
-- 3 demo properties (여수 웰카운티 / 디오션 / 엑스포) with 11 demo units, plus their
-- sample bookings, contracts, invoices and documents.
--
-- Why: those 11 units are NOT part of Metheim 여수 (property_id = 1). They were
-- seeded only to give the redesigned owner-portal dashboard something to render,
-- and they inflate the unit count on admin lists / dashboards / reports
-- (269 real units → 280). Metheim's canonical unit count is 269.
--
-- Soft delete = `deleted_at` stamped. Rows disappear from every list, dashboard
-- and report but stay in the 보관함 (archive) view and can be restored — see the
-- rollback block at the bottom.
--
-- Target: Metheim Supabase (Seoul).
-- Run:
--   psql "$METHEIM_DATABASE_URL" -f tenants/metheim/archive-owner-sample-properties.sql
-- =============================================================================

BEGIN;

-- Documents attached to the sample property / contract / invoice records.
UPDATE documents d SET deleted_at = now()
 WHERE d.deleted_at IS NULL
   AND (
     (d.entity_type = 'property' AND d.entity_id IN (
        SELECT id FROM properties WHERE owner_account_id = 3 AND description = 'SAMPLE-OWNER-SEED'))
     OR (d.entity_type = 'contract' AND d.entity_id IN (
        SELECT id FROM contracts WHERE contract_ref LIKE 'SMP-CT-%'))
     OR (d.entity_type = 'invoice' AND d.entity_id IN (
        SELECT id FROM invoices WHERE invoice_ref LIKE 'SMP-INV-%'))
   );

UPDATE invoices  SET deleted_at = now() WHERE deleted_at IS NULL AND invoice_ref  LIKE 'SMP-INV-%';
UPDATE contracts SET deleted_at = now() WHERE deleted_at IS NULL AND contract_ref LIKE 'SMP-CT-%';
UPDATE bookings  SET deleted_at = now() WHERE deleted_at IS NULL AND booking_ref  LIKE 'SMP-BK-%';

UPDATE spaces SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND property_id IN (SELECT id FROM properties WHERE owner_account_id = 3 AND description = 'SAMPLE-OWNER-SEED');

UPDATE properties SET deleted_at = now()
 WHERE deleted_at IS NULL AND owner_account_id = 3 AND description = 'SAMPLE-OWNER-SEED';

-- Verification: expected 269 live units for Metheim 여수 (property_id = 1),
-- excluding the 8 type-container rows (A타입 … E-1타입).
SELECT count(*) AS live_units
  FROM spaces s
 WHERE s.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM spaces c WHERE c.parent_space_id = s.id AND c.deleted_at IS NULL);

COMMIT;

-- ── Rollback (restore the demo data) ────────────────────────────────────────
-- BEGIN;
-- UPDATE properties SET deleted_at = NULL WHERE owner_account_id = 3 AND description = 'SAMPLE-OWNER-SEED';
-- UPDATE spaces     SET deleted_at = NULL WHERE property_id IN (SELECT id FROM properties WHERE owner_account_id = 3 AND description = 'SAMPLE-OWNER-SEED');
-- UPDATE bookings   SET deleted_at = NULL WHERE booking_ref  LIKE 'SMP-BK-%';
-- UPDATE contracts  SET deleted_at = NULL WHERE contract_ref LIKE 'SMP-CT-%';
-- UPDATE invoices   SET deleted_at = NULL WHERE invoice_ref  LIKE 'SMP-INV-%';
-- UPDATE documents  SET deleted_at = NULL WHERE doc_ref LIKE 'SMP-%' OR doc_ref LIKE 'DOC-P%';
-- COMMIT;
