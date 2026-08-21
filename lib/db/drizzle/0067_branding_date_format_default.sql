-- 날짜 표기 공통 기준을 YYYY/MM/DD 로 통일한다.
-- 앱(어드민·랜딩·포털)과 서버 문서의 코드 기본값이 모두 YYYY/MM/DD 로 바뀌었으므로
-- 새 테넌트 행이 만들어질 때도 같은 값이 들어오도록 컬럼 기본값을 맞춘다.
-- 이미 저장된 행은 건드리지 않는다 — 테넌트가 Settings → Organisation 에서 고른 값이라
-- 여기서 덮으면 의도적으로 다른 표기를 쓰는 인스턴스가 조용히 바뀐다.
ALTER TABLE branding_settings ALTER COLUMN date_format SET DEFAULT 'YYYY/MM/DD';
