-- Additive: Korean real-estate area breakdown on spaces (전용/주거공용/공급/
-- 기타공용/계약면적 + 대지지분, ㎡). Typically authored on the parent "type"
-- space (상위공간). supply = exclusive + residential_common; contract = supply
-- + other_common. Applied directly to prod via psql. Additive-only, nullable.
ALTER TABLE "spaces"
  ADD COLUMN IF NOT EXISTS "exclusive_area_m2" numeric(10,3),
  ADD COLUMN IF NOT EXISTS "residential_common_area_m2" numeric(10,3),
  ADD COLUMN IF NOT EXISTS "supply_area_m2" numeric(10,3),
  ADD COLUMN IF NOT EXISTS "other_common_area_m2" numeric(10,3),
  ADD COLUMN IF NOT EXISTS "contract_area_m2" numeric(10,3),
  ADD COLUMN IF NOT EXISTS "land_share_m2" numeric(10,3);
