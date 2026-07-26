-- 0017 — Work-order owner charge-back linkage + work-order photo attachments.
-- Additive only. Fixes onboarding-test findings #5 (no owner rebill flow for
-- repair costs) and #7 (work orders had no native photo slot).

-- #5: link a repair-cost charge-back invoice back to the work order it recovers.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS work_order_id integer;

-- #7: before/after (request/confirmation) photos on a work order.
CREATE TABLE IF NOT EXISTS work_order_photos (
  id serial PRIMARY KEY,
  work_order_id integer NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'after',
  uploaded_by_type text NOT NULL DEFAULT 'admin',
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_order_photos_work_order_id_idx ON work_order_photos (work_order_id);
