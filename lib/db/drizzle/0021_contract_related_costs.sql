-- Contract-related one-off costs (입주청소 / 임대수수료 입금 / 부동산 수수료 입금 등).
-- 0..N per contract; cost_type is free-text (freely extensible).
-- Each row: 송금일(remitted_on) / 이름(payee_name) / 송금액(amount) / 비고(note).
CREATE TABLE IF NOT EXISTS contract_related_costs (
  id          serial PRIMARY KEY,
  contract_id integer NOT NULL,
  cost_type   text NOT NULL,
  remitted_on text,
  payee_name  text NOT NULL DEFAULT '',
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'AUD',
  note        text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'Active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_related_costs_contract
  ON contract_related_costs (contract_id);
