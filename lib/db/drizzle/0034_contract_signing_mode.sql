-- 서명 방식 수동 재지정
--
-- 온라인 서명 가능 여부는 계약기간으로 자동 판정한다(1달 이하 = 온라인).
-- 경계 사례(예: 35일 한달살기)를 담당자가 뒤집을 수 있게 재지정 값과 사유를 남긴다.
--   signing_mode        : 'online' | 'wet' | NULL(자동 판정 따름)
--   signing_mode_reason : 자동 판정을 뒤집은 사유(감사용)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signing_mode text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signing_mode_reason text;
