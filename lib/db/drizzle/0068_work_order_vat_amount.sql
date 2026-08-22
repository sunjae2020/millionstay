-- 0068 — 작업지시 부가세 칸.
--
-- 작업비용(cost)에 대해 두 가지 세금이 붙는다:
--   - 원천징수 3.3% (프리랜서·개인 사업자) → withholding_amount, 차감
--   - 부가세 10% (일반과세자) → vat_amount, 가산
-- 실무에서는 둘 중 하나만 발생하지만 칸은 따로 두고 각각 수기 수정할 수 있게
-- 한다. 청구비용(net_cost) = 작업비용 - 원천징수 + 부가세.
--
-- Additive only, nullable: 이전 행은 vat_amount NULL(=0)로 종전과 같이 계산된다.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS vat_amount numeric(12,2);
