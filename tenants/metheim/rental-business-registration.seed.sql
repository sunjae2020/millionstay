-- Metheim 임대사업자 등록증 시드 — 등록증 머릿말 + 1/37쪽에 적힌 14세대.
-- 나머지 쪽은 관리자 화면의 "등록증 표 붙여넣기"로 등재한다. 재실행 안전(호수 중복 방지).
BEGIN;

INSERT INTO integration_settings (key, value, updated_at)
VALUES ('rental_business_registration', json_build_object(
  'registration_no', '2026-여수시-임대사업자-11',
  'first_registered_on', '2025-07-23',
  'operator_name', '(주)에이치케이건설자산관리',
  'operator_reg_no', '135811-0244079',
  'address', '전라남도 여수시 좌수영로 101 102호 (연등동, 메트하임 여수)',
  'phone', '',
  'mobile', '010-2747-9612',
  'issuing_authority', '여수시장'
)::text, now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO rental_business_units
  (unit_no, building_address, acquisition_type, housing_kind, housing_type,
   exclusive_area_label, registered_on, lease_started_on, registration_history, sort_order)
SELECT v.unit_no, '전라남도 여수시 좌수영로 101 (연등동, 메트하임 여수)', '매입',
       '장기일반민간임대주택(10년)', '아파트(도시형생활주택)',
       v.area, '2026-04-27', v.lease_start, '최초', v.ord
FROM (VALUES
  ('1001호', '40㎡이하', NULL, 1),
  ('1002호', '40㎡이하', '2026-04-27', 2),
  ('1008호', '40㎡이하', NULL, 3),
  ('1010호', '40㎡이하', NULL, 4),
  ('1011호', '40㎡이하', NULL, 5),
  ('1012호', '40㎡이하', NULL, 6),
  ('1018호', '40㎡초과~60㎡이하', NULL, 7),
  ('1101호', '40㎡이하', NULL, 8),
  ('1102호', '40㎡이하', NULL, 9),
  ('1104호', '40㎡이하', NULL, 10),
  ('1105호', '40㎡이하', NULL, 11),
  ('1107호', '40㎡이하', NULL, 12),
  ('1108호', '40㎡이하', NULL, 13),
  ('1109호', '40㎡이하', '2026-04-27', 14)
) AS v(unit_no, area, lease_start, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM rental_business_units r
  WHERE r.unit_no = v.unit_no AND r.deleted_at IS NULL
);

-- 호수 ↔ spaces.name 자동 연결(같은 호수가 하나뿐일 때만).
UPDATE rental_business_units r
SET space_id = s.id
FROM spaces s
WHERE r.space_id IS NULL
  AND r.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND s.name = r.unit_no
  AND (SELECT count(*) FROM spaces x WHERE x.deleted_at IS NULL AND x.name = r.unit_no) = 1;

COMMIT;
