-- 파트너 포털 임시 비밀번호 (계정 → 포털 사용)
--
-- 담당자가 임시 비밀번호를 발급하면 1회만 화면에 표시되고, 파트너는 그 비밀번호로
-- 로그인해 곧바로 비밀번호를 바꿔야 한다(force_password_change). 만료
-- (temp_password_expires_at, 기본 72시간)가 지나면 로그인 자체가 거부된다.
--
-- 어드민 계정(users.force_password_change)과 같은 이름을 쓴다 — 두 테이블에서
-- 뜻이 같아야 나중에 읽는 사람이 헷갈리지 않는다.
--
-- Additive-only. (Branch draft was numbered 0093; renumbered 0101 — 0093 is taken on main.)
-- Already applied to the Metheim production DB; IF NOT EXISTS keeps this a no-op there.
ALTER TABLE "partner_users" ADD COLUMN IF NOT EXISTS "force_password_change" boolean NOT NULL DEFAULT false;
ALTER TABLE "partner_users" ADD COLUMN IF NOT EXISTS "temp_password_expires_at" timestamp with time zone;
