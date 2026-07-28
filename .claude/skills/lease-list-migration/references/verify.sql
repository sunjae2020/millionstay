-- 임대리스트 이관 사후 검증 — 모든 값이 0 이어야 한다.
-- 사용:  psql "<DB URL>" -f verify.sql
\pset pager off

SELECT '1. 호실 매칭 실패 (계약에 space_id 없음)' AS 점검, count(*) AS 건수
  FROM contracts WHERE deleted_at IS NULL AND contract_ref LIKE 'MH-L-%' AND space_id IS NULL
UNION ALL
SELECT '2. 세입자 계정 미연결', count(*)
  FROM contracts WHERE deleted_at IS NULL AND contract_ref LIKE 'MH-L-%' AND tenant_account_id IS NULL
UNION ALL
SELECT '3. 같은 호실+입주일 계약 중복', count(*) FROM (
  SELECT space_id, start_date FROM contracts
   WHERE deleted_at IS NULL AND space_id IS NOT NULL AND start_date IS NOT NULL
   GROUP BY 1,2 HAVING count(*) > 1) x
UNION ALL
SELECT '4. 계약-월 인보이스 중복', count(*) FROM (
  SELECT contract_id, substring(due_date,1,7) m FROM invoices
   WHERE deleted_at IS NULL AND contract_id IS NOT NULL AND due_date IS NOT NULL
   GROUP BY 1,2 HAVING count(*) > 1) x
UNION ALL
-- 자동 생성된 미납 청구서만 결함이다. 입금 완료(Paid) 이력이 기간을 벗어난 것은
-- "계약이 연장됐는데 종료일이 갱신되지 않은" 실제 사실이므로 아래 참고 항목에서 센다.
SELECT '5. 계약 기간 밖 자동 청구서', count(*)
  FROM invoices i JOIN contracts c ON c.id = i.contract_id
 WHERE i.deleted_at IS NULL AND c.deleted_at IS NULL AND i.due_date IS NOT NULL
   AND i.invoice_ref LIKE 'RENT-%' AND i.status <> 'Paid'
   AND ((c.start_date IS NOT NULL AND i.due_date < c.start_date)
     OR (c.end_date   IS NOT NULL AND i.due_date > c.end_date))
UNION ALL
SELECT '6. 삭제된 계약에 남은 청구서', count(*)
  FROM invoices i JOIN contracts c ON c.id = i.contract_id
 WHERE i.deleted_at IS NULL AND c.deleted_at IS NOT NULL
UNION ALL
SELECT '7. 청구일이 계약 납입일과 불일치', count(*)
  FROM invoices i JOIN contracts c ON c.id = i.contract_id
 WHERE i.deleted_at IS NULL AND i.invoice_ref LIKE 'RENT-%' AND c.rent_due_day IS NOT NULL
   AND substring(i.due_date,9,2)::int <> least(c.rent_due_day, 28)
UNION ALL
SELECT '8. 성이 분리되지 않은 연락처', count(*)
  FROM contacts WHERE deleted_at IS NULL AND coalesce(last_name,'') = '' AND first_name ~ '[가-힣]{2,}'
UNION ALL
SELECT '9. 중복 연락처 (성+이름+휴대폰)', count(*) FROM (
  SELECT first_name, last_name, coalesce(mobile_number,'') m FROM contacts
   WHERE deleted_at IS NULL GROUP BY 1,2,3 HAVING count(*) > 1) x
UNION ALL
SELECT '10. 중복 계정명', count(*) FROM (
  SELECT name FROM accounts WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1) x
UNION ALL
SELECT '11. float 금액 컬럼 (numeric 이어야 함)', count(*)
  FROM information_schema.columns
 WHERE table_schema = 'public' AND data_type IN ('real','double precision')
   AND column_name ~ 'amount|price|fee|rent|cost'
   AND NOT (table_name = 'commissions' AND column_name = 'commission_rate');

-- 참고용 현황 (0 이 아니어도 정상)
SELECT '계약' AS 항목, count(*)::text AS 값 FROM contracts WHERE deleted_at IS NULL AND contract_ref LIKE 'MH-L-%'
UNION ALL SELECT '연락처', count(*)::text FROM contacts WHERE deleted_at IS NULL
UNION ALL SELECT '세입자 계정', count(*)::text FROM accounts WHERE deleted_at IS NULL AND account_type = 'Tenant'
UNION ALL SELECT '관련비용', count(*)::text FROM contract_related_costs
UNION ALL SELECT '미납 청구서', count(*)::text FROM invoices WHERE deleted_at IS NULL AND status = 'Overdue'
UNION ALL SELECT '임대중 세대', count(*)::text FROM spaces WHERE parent_space_id IS NOT NULL AND status = '임대'
UNION ALL SELECT '보증금 합계', sum(bond_amount)::bigint::text FROM contracts WHERE deleted_at IS NULL AND contract_ref LIKE 'MH-L-%'
UNION ALL SELECT '종료일 이후 입금 이력(연장 의심)', count(*)::text
  FROM invoices i JOIN contracts c ON c.id = i.contract_id
 WHERE i.deleted_at IS NULL AND c.deleted_at IS NULL AND i.status = 'Paid'
   AND c.end_date IS NOT NULL AND i.due_date > c.end_date;
