-- 계약서 서식 선택 + 첨부 문서 옵션
--
-- lease_form       : 어떤 계약서 서식으로 발급할지
--                    housing_standard = 법무부 주택임대차표준계약서(일반 임대인)
--                    mlt_standard     = 민간임대주택 표준임대차계약서(등록임대사업자)
--                    general          = 자사 일반 임대차계약서
--                    NULL 이면 기존 동작(general) 그대로.
-- doc_attachments  : 계약서 뒤에 붙일 첨부 문서 키 JSON 배열
--                    예) ["special_terms","deposit_consent"]
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS lease_form text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS doc_attachments text;
