-- 0052 — 계약 당사자 신원 항목(주민등록번호)
--
-- 한국 임대차 계약서의 당사자 표는 임대인 칸에 사업자등록번호/법인등록번호,
-- 임차인 칸에 주민등록번호를 적는다. 지금까지 주민등록번호는 어디에도 저장하지
-- 않아 발급된 계약서의 해당 칸이 늘 비어 나갔다.
--
-- 입력 경로는 연락처 → 계정관리 → 계약서 한 방향이다. 사람의 번호이므로 원본은
-- 연락처(contacts)에 두고, 계정(accounts)에는 "연락처에서 채우기" 검토 팝업을
-- 거쳐 복사된 값이 들어간다. 계약서는 계정 값을 쓰되 비어 있으면 대표 연락처의
-- 값으로 대체한다.
--
-- ⚠ 민감정보(고유식별정보)다. 로거 redact 목록(lib/logger.ts)에 등록되어 있고,
-- 화면에서는 뒷자리를 마스킹해 보여준다. 발급 문서에만 전체 값이 인쇄된다.
--
-- Additive only.
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "resident_no" text;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "resident_no" text;
