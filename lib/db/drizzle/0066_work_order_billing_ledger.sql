-- 0066 — 작업지시 청구·정산 원장: work_orders carries the Korean
-- 퇴거청소·입주청소·하자보수 LIST's money columns.
--
-- A row of that sheet is a job done to a *unit*: 청소일자 / 호수 / 작업내용 /
-- 작업비용 / 3.3%공제액 / 하자내용 / 청구일 / 수령일자. work_orders already owns
-- the space, the vendor (service_host_id), the cost and the photos — these
-- columns add the tenancy reference and the Korean money/settlement fields, so
-- the 청구 명세서 bills the amount confirmed on the job instead of re-deriving it.
--
-- Additive only: every column is nullable (or defaulted), so rows written before
-- this migration keep working and the statement falls back to its withholding
-- calculation for them.
--
-- contract_id is nullable on purpose: work done while a unit is vacant belongs
-- to no tenancy, and older tenancies may not be migrated yet.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS contract_id integer;

-- 작업비용 (cost) is the vendor's gross claim; 3.3% 원천징수 is withheld, so
-- net_cost is the amount actually remitted — and the amount billed.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS net_cost numeric(12,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS withholding_amount numeric(12,2);

-- 청구일 / 수령일자. settled_on stays NULL while the charge is outstanding
-- (the sheet's '청구' state).
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS billed_on text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS settled_on text;

-- settlement_method: tenant_payment (퇴거 시 납부) | deposit_deduction (보증금 차감)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS settlement_method text;

-- charged_to: tenant (default) | landlord | company — most jobs are the outgoing
-- tenant's, but vacant-period maintenance is the owner's or ours.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS charged_to text NOT NULL DEFAULT 'tenant';

CREATE INDEX IF NOT EXISTS work_orders_contract_id_idx ON work_orders (contract_id);
CREATE INDEX IF NOT EXISTS work_orders_space_id_idx ON work_orders (space_id);
