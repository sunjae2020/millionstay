-- 리프레시 토큰 계열(family) — 로그인 한 번에서 갈라져 나온 토큰들을 한 묶음으로 본다.
--
-- 지금까지는 이미 회전된(폐기된) 토큰이 다시 들어오면 도난으로 보고 그 사용자의
-- '모든' 세션을 말소했다. 그래서 오래 켜둔 노트북 탭 하나가 죽은 토큰을 재시도하면
-- 다른 기기에서 한창 작업 중이던 세션까지 같이 끊겼다(2026-09-08, admin user 1:
-- Windows 탭의 낡은 토큰이 방금 갱신된 Mac 세션을 0.05초 만에 폐기 → 1시간 15분 401).
-- 앞으로는 문제가 된 계열만 끊는다.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id uuid;

-- 기존 행은 자기 자신을 계열로 삼는다(1인 계열). 회전 이력은 복원할 수 없지만,
-- 이 상태여도 "다른 기기까지 끊지 않는다"는 목적은 그대로 달성된다.
UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
