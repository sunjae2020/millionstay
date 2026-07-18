-- 0003_invoice_line_type_deposit
-- H-402: refundable security deposits were posted to GL Revenue (commingled),
-- with no liability account. Add invoice_line_items.line_type so deposit lines can
-- be tagged and posted to a "Deposits Held" liability account (2100) instead of
-- Revenue (4000) at payment time.
--
-- Additive, safe: new NOT NULL column with default 'revenue' → all existing rows
-- become 'revenue' (their prior behavior). GL is empty in prod (harness [0]), so
-- no historical entries need reversing.
--
-- Rollback: ALTER TABLE public.invoice_line_items DROP COLUMN line_type;

ALTER TABLE public.invoice_line_items
  ADD COLUMN line_type text NOT NULL DEFAULT 'revenue';
