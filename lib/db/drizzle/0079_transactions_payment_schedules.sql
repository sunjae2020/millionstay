-- 거래 원장(transactions) + 계약 결제 일정(payment_schedules)
--
-- 지금까지 "받을 돈"은 invoices, "회계 기록"은 journal_entries 에 있었지만 그
-- 사이의 **실제 입출금**을 담는 표가 없었다. 그래서 /finance/transactions 가
-- 빈 화면이었고, 월세가 언제 얼마 들어왔는지는 인보이스 status 하나로만
-- 짐작해야 했다.
--
-- payment_schedules 는 contracts 의 낱개 결제 컬럼(계약금·중도금·잔금·보증금·
-- 월세)을 회차 행으로 펼친 것이다. 회차가 행이 되어야 인보이스와 입금이 "몇
-- 회차"를 가리킬 수 있다. 생성은 계약 컬럼에서 자동으로 하되, 생성 후에는 이
-- 표가 정본이다.
--
-- Additive-only. 기존 표는 건드리지 않는다.

CREATE TABLE IF NOT EXISTS "payment_schedules" (
  "id" serial PRIMARY KEY,
  "contract_id" integer NOT NULL,
  "kind" text NOT NULL DEFAULT 'rent',
  "seq" integer NOT NULL DEFAULT 0,
  "label" text,
  "period" text,
  "period_start" text,
  "period_end" text,
  "due_date" text,
  "amount" numeric(14,2) NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'AUD',
  "invoice_id" integer,
  "paid_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "paid_at" timestamptz,
  "status" text NOT NULL DEFAULT 'pending',
  "source" text NOT NULL DEFAULT 'auto',
  "notes" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_schedules_contract_idx" ON "payment_schedules" ("contract_id");
CREATE INDEX IF NOT EXISTS "payment_schedules_invoice_idx" ON "payment_schedules" ("invoice_id");
CREATE INDEX IF NOT EXISTS "payment_schedules_due_date_idx" ON "payment_schedules" ("due_date");

-- 한 계약의 같은 종류·같은 대상월 회차는 하나뿐이다. 자동 재생성이 월세 회차를
-- 중복 적재하는 사고를 DB 층에서 막는다(수동 추가 행은 period 를 비우므로
-- 이 제약에 걸리지 않는다 — NULL 은 서로 같지 않다).
CREATE UNIQUE INDEX IF NOT EXISTS "payment_schedules_contract_kind_period_key"
  ON "payment_schedules" ("contract_id", "kind", "period")
  WHERE "deleted_at" IS NULL AND "period" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" serial PRIMARY KEY,
  "txn_ref" text NOT NULL,
  "txn_type" text NOT NULL DEFAULT 'income',
  "txn_date" text NOT NULL,
  "amount" numeric(14,2) NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'AUD',
  "tax_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "contract_id" integer,
  "invoice_id" integer,
  "payment_schedule_id" integer,
  "work_order_id" integer,
  "space_id" integer,
  "account_id" integer,
  "contact_id" integer,
  "counterparty_name" text,
  "bank_account_id" integer,
  "counter_bank_account_id" integer,
  "payment_info_id" integer,
  "payment_method" text,
  "gl_account_code" text,
  "description" text,
  "bank_reference" text,
  "notes" text,
  "status" text NOT NULL DEFAULT 'draft',
  "journal_entry_id" integer,
  "posted_at" timestamptz,
  "posted_by" integer,
  "confirmed_at" timestamptz,
  "confirmed_by" integer,
  "voided_at" timestamptz,
  "void_reason" text,
  "created_by" integer,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_txn_ref_key" ON "transactions" ("txn_ref");
CREATE INDEX IF NOT EXISTS "transactions_contract_idx" ON "transactions" ("contract_id");
CREATE INDEX IF NOT EXISTS "transactions_invoice_idx" ON "transactions" ("invoice_id");
CREATE INDEX IF NOT EXISTS "transactions_schedule_idx" ON "transactions" ("payment_schedule_id");
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions" ("txn_date");
CREATE INDEX IF NOT EXISTS "transactions_bank_account_idx" ON "transactions" ("bank_account_id");
