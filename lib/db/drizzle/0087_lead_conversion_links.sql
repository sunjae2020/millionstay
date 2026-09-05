-- 문의(lead) 가 무엇으로 전환됐는지 남긴다.
--
-- 지금까지 전환은 lead_status 를 바꾸기만 했고, 만들어진 예약·계약과의 연결이
-- 어디에도 없었다. "이 계약이 어느 문의에서 왔나"를 되짚을 수 없다는 뜻이고,
-- 같은 문의를 두 번 전환해도 막을 근거가 없었다.
--
-- 세 칸을 더한다. 연락처·계정은 전환할 때 자동으로 만들어지므로, 두 번째 전환은
-- 새로 만드는 대신 이 칸이 가리키는 것을 재사용한다.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_contract_id integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_contact_id  integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_account_id  integer;
