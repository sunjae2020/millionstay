-- Money columns must be numeric, never float. The Metheim DB was created from an
-- older snapshot where these were `real`, so it drifted from the code schema
-- (all of them are numeric(12,2) in lib/db/src/schema). Stored values happen to be
-- exact, but float4 summation loses precision — SUM(bond_amount) over the 98
-- imported leases came out 32원 short of ₩732,500,000.
--
-- Only genuine money columns are converted. Columns the code deliberately keeps as
-- `real` — commissions.commission_rate, *_weeks, *_percentage, lat/lng,
-- spaces.floor_area_sqm — are left alone.
--
-- Idempotent: each ALTER runs only where the column is still `real`, so a database
-- already on numeric (the primary instance) is untouched.
DO $$
DECLARE
  t text; c text;
  targets text[][] := ARRAY[
    ['accommodation_addons','price_override'],
    ['accommodation_catalog','admin_fee'],
    ['accommodation_catalog','bond_amount'],
    ['accommodation_catalog','cleaning_fee'],
    ['accommodation_catalog','price'],
    ['accommodation_catalog','weekly_rate'],
    ['accommodation_service_catalog','custom_price'],
    ['addon_services','base_price'],
    ['beneficiaries','fixed_amount'],
    ['commissions','commission_amount'],
    ['contract_products','admin_fee'],
    ['contract_products','bond_amount'],
    ['contract_products','cleaning_fee'],
    ['contract_products','effective_weekly_rate'],
    ['contract_products','monthly_rate'],
    ['contract_products','weekly_rate'],
    ['contracts','advance_amount'],
    ['contracts','bond_amount'],
    ['contracts','total_rent'],
    ['contracts','weekly_rate'],
    ['service_catalog','base_price'],
    ['space_service_catalog','custom_price'],
    ['spaces','base_daily_price'],
    ['spaces','base_weekly_price'],
    ['work_orders','cost']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    t := targets[i][1];
    c := targets[i][2];
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = c
         AND data_type IN ('real', 'double precision')
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE numeric(12,2) USING round(%I::numeric, 2)',
        t, c, c);
      RAISE NOTICE 'converted %.% → numeric(12,2)', t, c;
    END IF;
  END LOOP;
END $$;
