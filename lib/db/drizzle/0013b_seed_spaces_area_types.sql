-- Data seed (NOT a schema migration): populate the 8 unit-type parent spaces
-- (상위공간 A / A-1 / B / C / D / D-1 / E / E-1) with their registered area
-- breakdown (㎡). Run AFTER 0013_spaces_area_breakdown.sql.
--
-- Supply = exclusive + residential_common; contract = supply + other_common
-- (verified consistent against the source ledger).
--
-- Identity: Metheim Seoul DB — the 8 parent-type spaces are named "A타입",
-- "A-1타입", … (ids 276–283, property_id = 1). Matched by name below.

UPDATE "spaces" AS s SET
  exclusive_area_m2          = v.exclusive,
  residential_common_area_m2 = v.res_common,
  supply_area_m2             = v.supply,
  other_common_area_m2       = v.other_common,
  contract_area_m2           = v.contract,
  land_share_m2              = v.land_share
FROM (VALUES
  ('A타입',   18.490, 10.840, 29.330, 18.845, 48.175,  8.809),
  ('A-1타입', 18.390, 10.896, 29.286, 18.743, 48.029,  8.762),
  ('B타입',   19.990, 11.602, 31.592, 20.375, 51.966,  9.524),
  ('C타입',   25.760, 14.388, 40.148, 26.256, 66.404, 12.273),
  ('D타입',   37.530, 21.222, 58.752, 38.252, 97.004, 17.880),
  ('D-1타입', 37.530, 21.222, 58.752, 38.252, 97.004, 17.880),
  ('E타입',   40.920, 22.508, 63.428, 41.707, 105.135, 19.495),
  ('E-1타입', 40.920, 22.508, 63.428, 41.707, 105.135, 19.495)
) AS v(type, exclusive, res_common, supply, other_common, contract, land_share)
WHERE s.name = v.type
  AND s.property_id = 1;
