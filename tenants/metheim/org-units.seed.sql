-- 메트하임 여수 — 지점·팀 초기 구성
--
-- 회계 접근 범위(HQ/지점/팀)의 조직 뼈대. 팀 구성은 실제 운영 데이터에서 뽑았다:
--   장기임대 141건 · 공간 277호 · 청구 2,105건 · 작업지시 100건
--   (수리 38 · 퇴실청소 24 · 입실청소 20 · 배관 12 · 청소 2 · 보안 1)
--   분양·판매 매물 6건 · 리드 3건
-- 기존 직원 부서 표기(임대관리실 / 회계팀)와도 맞췄다.
--
-- 멱등하다 — 코드(code)가 이미 있으면 건너뛴다. 여러 번 돌려도 안전하다.
-- ⚠️ 이 시드는 조직만 만든다. 직원 소속 배정과 스코프 스위치는 별도다
--    (설정 → 사용자, 설정 → 지점·팀). 순서를 지키지 않으면 아무도 아무것도 못 본다.

-- ── 지점 ────────────────────────────────────────────────────────────────────
INSERT INTO branches (name, code, is_headquarters, phone, sort_order, is_active, notes)
SELECT '본사', 'HQ', true, '031-926-2281', 1, true, '(주)HK건설자산관리 본사 — 경영·회계 총괄. 전 지점의 회계를 본다.'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'HQ' AND deleted_at IS NULL);

INSERT INTO branches (name, code, is_headquarters, address, phone, sort_order, is_active, notes)
SELECT '여수지점', 'YS', false,
       '전남 여수시 좌수영로 101 102호(연등동 메트하임 여수)', '031-926-2281', 2, true,
       '메트하임 여수 운영 거점 — 임대·시설·미화·분양 실무.'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'YS' AND deleted_at IS NULL);

-- ── 팀 ──────────────────────────────────────────────────────────────────────
-- 본사: 경영·회계. 회계팀은 청구 2,105건과 정산을 다루므로 전사 단위로 둔다.
INSERT INTO teams (branch_id, name, code, sort_order, is_active, notes)
SELECT b.id, '경영지원팀', 'HQ-MGT', 1, true, '대표 직속 — 경영·총무·인사'
FROM branches b WHERE b.code = 'HQ' AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM teams WHERE code = 'HQ-MGT' AND deleted_at IS NULL);

INSERT INTO teams (branch_id, name, code, sort_order, is_active, notes)
SELECT b.id, '회계팀', 'HQ-FIN', 2, true, '청구·수납·정산·원장 (청구 2,105건)'
FROM branches b WHERE b.code = 'HQ' AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM teams WHERE code = 'HQ-FIN' AND deleted_at IS NULL);

-- 여수지점: 실무 4팀. 작업지시가 "수리·배관"과 "입·퇴실 청소"로 뚜렷이 갈려
-- 시설과 미화를 나눴다(51건 대 46건).
INSERT INTO teams (branch_id, name, code, sort_order, is_active, notes)
SELECT b.id, '임대관리팀', 'YS-LEASE', 1, true, '계약·입주·퇴거·세입자 응대 (장기 141건 · 277호실)'
FROM branches b WHERE b.code = 'YS' AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM teams WHERE code = 'YS-LEASE' AND deleted_at IS NULL);

INSERT INTO teams (branch_id, name, code, sort_order, is_active, notes)
SELECT b.id, '시설관리팀', 'YS-FM', 2, true, '수리·배관·설비·보안 (작업지시 51건)'
FROM branches b WHERE b.code = 'YS' AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM teams WHERE code = 'YS-FM' AND deleted_at IS NULL);

INSERT INTO teams (branch_id, name, code, sort_order, is_active, notes)
SELECT b.id, '미화팀', 'YS-CLEAN', 3, true, '입주·퇴거 청소 및 공용부 미화 (작업지시 46건)'
FROM branches b WHERE b.code = 'YS' AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM teams WHERE code = 'YS-CLEAN' AND deleted_at IS NULL);

INSERT INTO teams (branch_id, name, code, sort_order, is_active, notes)
SELECT b.id, '분양·판매팀', 'YS-SALES', 4, true, '분양·매매 물건과 문의 응대 (매물 6건 · 리드 3건)'
FROM branches b WHERE b.code = 'YS' AND b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM teams WHERE code = 'YS-SALES' AND deleted_at IS NULL);
