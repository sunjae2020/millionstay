-- Additive: Rental commission fee RATE CARD (임대 수수료 기준표) behind
-- Settings → Rental Fee Schedule. Per property TYPE, the config amounts for
-- 중개수수료(부동산) / 자체수수료(자체 관리자) / Working(직접 모객). Actual amounts
-- paid on a contract still live in contract_related_costs; this table is the rule set.
CREATE TABLE IF NOT EXISTS "rental_fee_schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "type_label" text NOT NULL,
  "brokerage_fee" numeric(14, 2) NOT NULL DEFAULT 0,
  "self_fee" numeric(14, 2) NOT NULL DEFAULT 0,
  "working_fee" numeric(14, 2) NOT NULL DEFAULT 0,
  "brokerage_surcharge_rate" numeric(5, 2) NOT NULL DEFAULT 4,
  "self_withholding_rate" numeric(5, 2) NOT NULL DEFAULT 3.3,
  "currency" text NOT NULL DEFAULT 'KRW',
  "sort_order" integer NOT NULL DEFAULT 0,
  "note" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'Active',
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
