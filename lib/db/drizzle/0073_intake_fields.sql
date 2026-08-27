-- 입주 신청서(온라인)가 받아 오는 값들의 자리
--
-- 계약서에는 임대 조건이 다 들어 있지만, 입주 당일에 관리사무소가 실제로 묻는
-- 것들은 계약서에 없다: 차량 등록, 반려동물, 실제 거주 인원, 그리고 비상 시
-- 연락할 사람과의 관계. 지금까지 이 값들은 전화·카톡으로 오가고 어디에도 남지
-- 않았다. 세입자가 링크로 직접 적어 보내면 여기에 앉는다.
--
-- 비상연락처 이름·전화·이메일은 이미 contacts 에 있었고, 관계만 없었다 — 이름과
-- 번호만으로는 급할 때 누구에게 무슨 말을 해야 할지 판단할 근거가 안 된다.
--
-- Additive-only, 전부 nullable. 롤백은 각 컬럼 DROP.
ALTER TABLE "contacts"  ADD COLUMN IF NOT EXISTS "emergency_contact_relation" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "vehicle_no"  text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "pet_note"    text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cohabitants" text;
