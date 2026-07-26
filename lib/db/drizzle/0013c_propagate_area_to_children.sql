-- Data seed (NOT a schema migration): copy each parent unit-type's area
-- breakdown down to its child spaces (individual units). Run AFTER 0013b.
--
-- Metheim Seoul DB: the 8 type parents are ids 276–283; their children are the
-- 여수 269-unit ledger rows that reference them via parent_space_id. Denormalized
-- copy — children get a snapshot of the parent's areas at run time (they do NOT
-- auto-track later parent edits; re-run this to re-sync).

UPDATE "spaces" AS c SET
  exclusive_area_m2          = p.exclusive_area_m2,
  residential_common_area_m2 = p.residential_common_area_m2,
  supply_area_m2             = p.supply_area_m2,
  other_common_area_m2       = p.other_common_area_m2,
  contract_area_m2           = p.contract_area_m2,
  land_share_m2              = p.land_share_m2
FROM "spaces" AS p
WHERE c.parent_space_id = p.id
  AND p.id BETWEEN 276 AND 283
  AND p.exclusive_area_m2 IS NOT NULL;
