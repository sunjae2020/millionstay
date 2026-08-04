-- 0040 — 은행 대사 (bank reconciliation)
--
-- Closes the loop opened by 0039: the ledger can be internally consistent and
-- still wrong. A payout marked "paid" that was never actually transferred looks
-- identical to one that went out. Matching statement lines against journal
-- entries turns "we recorded it" into "the money moved".
-- See docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §7 step 8.
--
-- Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                 serial PRIMARY KEY,
  name               text NOT NULL,
  gl_account_code    text NOT NULL DEFAULT '1000',   -- chart_of_accounts.code
  bank_name          text,
  account_number     text,                            -- store masked / last-4
  currency           text NOT NULL DEFAULT 'KRW',
  statement_balance  numeric(14,2),
  last_imported_at   timestamptz,
  status             text NOT NULL DEFAULT 'Active',
  notes              text,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                serial PRIMARY KEY,
  bank_account_id   integer NOT NULL,
  txn_date          text NOT NULL,                    -- YYYY-MM-DD
  description       text NOT NULL,
  -- SIGNED: positive = money in, negative = money out. That single convention
  -- lets a line be compared directly against a journal entry's net cash movement.
  amount            numeric(14,2) NOT NULL,
  balance           numeric(14,2),
  reference         text,
  -- Import idempotency. Operators routinely export overlapping date ranges;
  -- silently doubling a month of transactions is far worse than importing none.
  dedupe_key        text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'unmatched', -- unmatched | reconciled | ignored
  matched_entry_id  integer,                           -- journal_entries.id
  matched_at        timestamptz,
  import_batch      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bt_account ON bank_transactions (bank_account_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_bt_status  ON bank_transactions (status);

-- One journal entry settles at most one statement line, so a single payment
-- cannot be used to "explain away" two different bank movements.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bt_matched_entry
  ON bank_transactions (matched_entry_id)
  WHERE matched_entry_id IS NOT NULL AND status = 'reconciled';
