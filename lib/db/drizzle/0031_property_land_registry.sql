-- 0031 — Property land/building registry details (등기부 표시)
--
-- Korean lease agreements print a 부동산의 표식 table on their 별지 (annex):
-- 소재지(지번)·건물용도·건물구조·토지지목·토지면적·대지권종류. These are
-- constant per building, so they live on `properties`; the per-unit parts
-- (전용/임대면적, 대지권비율) already exist on `spaces` (exclusive_area_m2,
-- land_share_m2) and are read unit → parent type space at render time.
--
-- Additive only — every column is nullable, so documents simply omit any row
-- that has not been filled in.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lot_address        text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_use       text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_structure text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_category      text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_area_m2       numeric(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_right_type    text;
