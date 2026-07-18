-- 0002_money_columns_numeric
-- H-401: currency amounts were stored as real (IEEE-754 float4) → cent drift, wrong
-- for money. Convert the 25 currency-amount columns to numeric(12,2). The Drizzle
-- schema maps them with { mode: "number" } so the TS/API type stays `number`
-- (non-breaking — no read-site or frontend change). Non-currency reals
-- (bond_weeks, advance_weeks, commission_rate, discount_percentage, floor_area_sqm)
-- are intentionally left as real. Table names verified against live DB.
--
-- Safe/lossless: prod measured 0 cent-drift, seed data (harness [0]). Transactional.
-- Rollback: re-run each ALTER with `TYPE real USING <col>::real`, then revert commit.

BEGIN;
ALTER TABLE public.accommodation_addons ALTER COLUMN price_override TYPE numeric(12,2) USING price_override::numeric(12,2);
ALTER TABLE public.accommodation_catalog ALTER COLUMN admin_fee TYPE numeric(12,2) USING admin_fee::numeric(12,2);
ALTER TABLE public.accommodation_catalog ALTER COLUMN bond_amount TYPE numeric(12,2) USING bond_amount::numeric(12,2);
ALTER TABLE public.accommodation_catalog ALTER COLUMN cleaning_fee TYPE numeric(12,2) USING cleaning_fee::numeric(12,2);
ALTER TABLE public.accommodation_catalog ALTER COLUMN price TYPE numeric(12,2) USING price::numeric(12,2);
ALTER TABLE public.accommodation_catalog ALTER COLUMN weekly_rate TYPE numeric(12,2) USING weekly_rate::numeric(12,2);
ALTER TABLE public.accommodation_service_catalog ALTER COLUMN custom_price TYPE numeric(12,2) USING custom_price::numeric(12,2);
ALTER TABLE public.addon_services ALTER COLUMN base_price TYPE numeric(12,2) USING base_price::numeric(12,2);
ALTER TABLE public.beneficiaries ALTER COLUMN fixed_amount TYPE numeric(12,2) USING fixed_amount::numeric(12,2);
ALTER TABLE public.commissions ALTER COLUMN commission_amount TYPE numeric(12,2) USING commission_amount::numeric(12,2);
ALTER TABLE public.contract_products ALTER COLUMN admin_fee TYPE numeric(12,2) USING admin_fee::numeric(12,2);
ALTER TABLE public.contract_products ALTER COLUMN bond_amount TYPE numeric(12,2) USING bond_amount::numeric(12,2);
ALTER TABLE public.contract_products ALTER COLUMN cleaning_fee TYPE numeric(12,2) USING cleaning_fee::numeric(12,2);
ALTER TABLE public.contract_products ALTER COLUMN effective_weekly_rate TYPE numeric(12,2) USING effective_weekly_rate::numeric(12,2);
ALTER TABLE public.contract_products ALTER COLUMN monthly_rate TYPE numeric(12,2) USING monthly_rate::numeric(12,2);
ALTER TABLE public.contract_products ALTER COLUMN weekly_rate TYPE numeric(12,2) USING weekly_rate::numeric(12,2);
ALTER TABLE public.contracts ALTER COLUMN advance_amount TYPE numeric(12,2) USING advance_amount::numeric(12,2);
ALTER TABLE public.contracts ALTER COLUMN bond_amount TYPE numeric(12,2) USING bond_amount::numeric(12,2);
ALTER TABLE public.contracts ALTER COLUMN total_rent TYPE numeric(12,2) USING total_rent::numeric(12,2);
ALTER TABLE public.contracts ALTER COLUMN weekly_rate TYPE numeric(12,2) USING weekly_rate::numeric(12,2);
ALTER TABLE public.service_catalog ALTER COLUMN base_price TYPE numeric(12,2) USING base_price::numeric(12,2);
ALTER TABLE public.space_service_catalog ALTER COLUMN custom_price TYPE numeric(12,2) USING custom_price::numeric(12,2);
ALTER TABLE public.spaces ALTER COLUMN base_daily_price TYPE numeric(12,2) USING base_daily_price::numeric(12,2);
ALTER TABLE public.spaces ALTER COLUMN base_weekly_price TYPE numeric(12,2) USING base_weekly_price::numeric(12,2);
ALTER TABLE public.work_orders ALTER COLUMN cost TYPE numeric(12,2) USING cost::numeric(12,2);
COMMIT;
