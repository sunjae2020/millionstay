-- 0039 — 지급 조건 + 정산 원장 (AR/AP payout legs)
--
-- Turns one customer receipt into settlement legs so the money we forward to
-- owners, partners and agents lives in the ledger, and net revenue (실 매출)
-- becomes a row that exists rather than a subtraction done in a report.
-- See docs/proposals/ACCOUNTING_UNIFIED_SPEC.md.
--
-- Additive only. Safe to re-run.

-- ── What is being charged, so percent-based payouts use the right base ──────
-- Only 'rent' lines feed a percent_of_rent term, so a move-in cleaning fee or
-- break fee riding on a rent invoice never inflates the owner's share.
-- No maintenance/utility value on purpose: 관리비 and 공과금 are paid by the
-- tenant directly to the management office and utility companies.
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS charge_kind text NOT NULL DEFAULT 'rent';

-- ── 지급 조건 — the rule ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_payout_terms (
  id                serial PRIMARY KEY,
  contract_id       integer NOT NULL,
  party_type        text NOT NULL,               -- landlord | service_host | agent
  payee_account_id  integer,
  payee_name        text NOT NULL DEFAULT '',
  basis             text NOT NULL,               -- percent_of_rent | fixed_monthly | fixed_once
  rate              numeric(5,2),
  amount            numeric(14,2),
  currency          text NOT NULL DEFAULT 'KRW',
  trigger           text NOT NULL DEFAULT 'on_ar_paid',
  cadence           text NOT NULL DEFAULT 'monthly',
  effective_from    text,
  effective_to      text,
  status            text NOT NULL DEFAULT 'Active',
  notes             text,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpt_contract ON contract_payout_terms (contract_id)
  WHERE deleted_at IS NULL;

-- ── 정산 원장 — the resulting money ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_settlements (
  id                serial PRIMARY KEY,
  settlement_ref    text NOT NULL UNIQUE,
  party_type        text NOT NULL,               -- landlord | service_host | agent | retained
  payee_account_id  integer,
  payee_name        text NOT NULL DEFAULT '',
  contract_id       integer,
  source_type       text,                        -- invoice | placement_payment
  source_id         integer,
  split_role        text NOT NULL DEFAULT 'external_payment',
  term_id           integer,
  basis_snapshot    text,
  rate_snapshot     numeric(5,2),
  base_amount       numeric(14,2),
  gross_amount      numeric(14,2) NOT NULL DEFAULT 0,
  deduction_amount  numeric(14,2) NOT NULL DEFAULT 0,
  amount            numeric(14,2) NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'KRW',
  status            text NOT NULL DEFAULT 'due', -- due | approved | paid | cancelled
  method            text,
  approved_at       timestamptz,
  paid_at           timestamptz,
  notes             text,
  created_by        integer,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ps_contract ON provider_settlements (contract_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ps_source ON provider_settlements (source_type, source_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ps_status ON provider_settlements (status, split_role)
  WHERE deleted_at IS NULL;

-- One receipt splits ONCE per term. Without this a retried webhook could pay
-- the same owner twice for the same month.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_source_term
  ON provider_settlements (source_type, source_id, term_id)
  WHERE deleted_at IS NULL AND term_id IS NOT NULL;

-- A `cadence='once'` term (agent referral fee) may produce at most ONE
-- settlement ever. Without this guard the referral re-accrues every month.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_once_term
  ON provider_settlements (term_id)
  WHERE deleted_at IS NULL AND term_id IS NOT NULL AND basis_snapshot = 'fixed_once';

-- ── Chart of Accounts: the codes the new postings reference ─────────────────
-- gl.ts ACCOUNTS is the source of truth for postings; these rows make the codes
-- visible in Settings → 계정과목 (previously the two systems did not know each
-- other). ON CONFLICT keeps an existing account intact — on an instance already
-- running the standard Korean chart, 1100 매출채권 and 5300 임차료 are already
-- there and mean exactly this, so nothing is inserted.
--
-- NOTE 5300, not 5200: in the standard Korean chart 5200 is 급여 (payroll), and
-- posting owner rent there would bury the largest cost line inside salaries.
INSERT INTO chart_of_accounts (code, name, account_type, sort_order, is_active)
VALUES
  ('1100', '매출채권', 'asset',   1100, true),
  ('5300', '임차료',   'expense', 5300, true)
ON CONFLICT (code) DO NOTHING;
