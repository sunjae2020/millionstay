-- 0084 회계기간 마감 + 자산대장 (FIN-001 제6·7조 / 제11조)
--
-- 마감은 명시적 행위다. 행이 없는 달은 open 으로 보므로, 이 마이그레이션을
-- 적용해도 기존 거래는 하나도 막히지 않는다.

CREATE TABLE IF NOT EXISTS accounting_periods (
  id            serial PRIMARY KEY,
  year          integer NOT NULL,
  month         integer NOT NULL,
  status        text    NOT NULL DEFAULT 'open',
  closed_at     timestamptz,
  closed_by     integer,
  reopened_at   timestamptz,
  reopened_by   integer,
  reopen_reason text,
  locked_at     timestamptz,
  locked_by     integer,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 한 달에 마감 행은 하나뿐이다.
CREATE UNIQUE INDEX IF NOT EXISTS accounting_periods_year_month_key
  ON accounting_periods (year, month);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id                    serial PRIMARY KEY,
  asset_no              text NOT NULL UNIQUE,
  name                  text NOT NULL,
  account_code          text,
  acquired_on           text NOT NULL,
  acquisition_cost      numeric(14,2) NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'KRW',
  residual_value        numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_years     integer NOT NULL DEFAULT 5,
  depreciation_method   text NOT NULL DEFAULT 'straight_line',
  space_id              integer,
  property_id           integer,
  custodian_user_id     integer,
  location_note         text,
  source_transaction_id integer,
  status                text NOT NULL DEFAULT 'draft',
  disposed_on           text,
  disposal_note         text,
  notes                 text,
  created_by            integer,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 지출결의 승인 시 같은 거래로 자산이 두 번 만들어지지 않게 한다.
CREATE UNIQUE INDEX IF NOT EXISTS fixed_assets_source_txn_key
  ON fixed_assets (source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS fixed_assets_status_idx ON fixed_assets (status);
