-- 0045 — prospects.attributes (소스별 이질적 메타데이터)
--
-- 콜드 리스트는 출처마다 들고 오는 항목이 다르다. 여수 관리대장에는 담당 구역과
-- 취급 물건 유형이 있고, 박람회 명함에는 부스 번호와 협회 소속이 있으며, 웹
-- 리서치 목록에는 아무것도 없을 수 있다. 이걸 고정 컬럼으로 받으면 소스가 하나
-- 늘 때마다 마이그레이션이 붙는다.
--
-- 그래서 공통 축(회사명·이메일·구분·국가)만 컬럼으로 두고, 소스 고유 항목은
-- 여기 JSONB로 담는다. 세그먼트 빌더는 이 JSONB를 펼쳐 실제로 존재하는 키만
-- 드롭다운으로 만들어 준다 — 코드에 키를 적어두지 않는다.
--
-- GIN 인덱스는 attributes->>key 등가 조회를 위한 것. jsonb_path_ops가 아니라
-- 기본 연산자 클래스를 쓴다(키 존재·값 비교를 모두 쓰기 때문).
--
-- 추가 전용. 재실행 안전.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_prospects_attributes ON prospects USING gin (attributes);

-- 소스는 이미 있는 컬럼(prospects.source). 목록은 enum이 아니라 데이터에서
-- 뽑으므로(SELECT DISTINCT) 조회 비용만 낮춰 둔다.
CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects (source);
