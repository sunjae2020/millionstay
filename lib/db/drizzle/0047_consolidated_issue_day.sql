-- 통합 청구서 발행 주기 — 세입자마다 "매월 28일에 다음 달분을 발행"처럼 생성일이
-- 정해져 있다(재원산업). NULL 이면 기존 동작(매일 이번 달분 재계산)을 유지한다.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS consolidated_issue_day integer;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS consolidated_issue_next_month boolean NOT NULL DEFAULT true;
