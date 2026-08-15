-- 법인 계정의 법인등록번호(13자리 등기 번호). 사업자등록번호와 다른 값이라
-- 별도 칸으로 두고, 임대차 계약서 당사자 표에 나란히 인쇄된다.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS corp_registration_no text;
