-- MetHeim: force KRW (한화) as the single currency for the whole instance.
-- (1) Relabel any non-KRW / NULL currency rows to KRW. The amounts are ALREADY
--     KRW-magnitude figures that were mislabeled with the schema 'AUD' default
--     (e.g. work_orders cost 80000 = ₩80,000), so this is a RELABEL, not an FX
--     conversion — converting would 1000x inflate them.
-- (2) Set every currency column DEFAULT to KRW so new rent/service/fee/invoice
--     records default to KRW. Per-instance (MetHeim has its own DB).
-- exchange_rates.from/to_currency and branding_settings.currency_position are
-- intentionally NOT touched.
BEGIN;

-- (1) relabel existing rows ─────────────────────────────────────────────────
UPDATE accommodation_catalog       SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE accounts                    SET default_currency='KRW' WHERE default_currency IS DISTINCT FROM 'KRW';
UPDATE addon_services              SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE agent_commission_ledger     SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE booking_services            SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE bookings                    SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE branding_settings           SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE channel_reservations        SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE contract_line_items         SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE contract_products           SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE contracts                   SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE deposit_settlements         SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE homestay_placement_payments SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE homestay_placement_services SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE homestay_placements         SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE invoices                    SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE journal_entries             SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE leads                       SET budget_currency='KRW'  WHERE budget_currency  IS DISTINCT FROM 'KRW';
UPDATE partner_payouts             SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE quotes                      SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE recurring_schedule          SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE service_catalog             SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE space_rate_calendar         SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE space_term_calendar         SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE work_orders                 SET currency='KRW'         WHERE currency         IS DISTINCT FROM 'KRW';
UPDATE spaces                      SET base_currency='KRW'    WHERE base_currency    IS DISTINCT FROM 'KRW';

-- (2) flip column DEFAULTs to KRW ────────────────────────────────────────────
ALTER TABLE accommodation_catalog       ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE accounts                    ALTER COLUMN default_currency SET DEFAULT 'KRW';
ALTER TABLE addon_services              ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE agent_commission_ledger     ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE booking_services            ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE bookings                    ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE branding_settings           ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE channel_reservations        ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE contract_line_items         ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE contract_products           ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE contracts                   ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE deposit_settlements         ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE homestay_placement_payments ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE homestay_placement_services ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE homestay_placements         ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE invoices                    ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE journal_entries             ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE leads                       ALTER COLUMN budget_currency  SET DEFAULT 'KRW';
ALTER TABLE partner_payouts             ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE quotes                      ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE recurring_schedule          ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE service_catalog             ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE space_rate_calendar         ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE space_term_calendar         ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE work_orders                 ALTER COLUMN currency         SET DEFAULT 'KRW';
ALTER TABLE spaces                      ALTER COLUMN base_currency    SET DEFAULT 'KRW';

COMMIT;
