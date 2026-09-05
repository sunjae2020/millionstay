-- 0086 IP → 예상 지역 캐시 (ip_geo_cache)
--
-- 시스템 로그의 IP 옆에 지역을 표시하려고 외부 조회 서비스를 부른다. 같은 IP 를
-- 화면 열 때마다 다시 묻지 않도록 결과를 여기에 캐시한다. 실패한 조회도 남겨서
-- 조회가 안 되는 IP 를 반복해서 두드리지 않게 한다.
--
-- 추가 전용(additive-only).

CREATE TABLE IF NOT EXISTS "ip_geo_cache" (
  "ip"           text PRIMARY KEY,
  "status"       text NOT NULL DEFAULT 'ok',
  "country_code" text,
  "country"      text,
  "region"       text,
  "city"         text,
  "source"       text,
  "looked_up_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ip_geo_looked_up" ON "ip_geo_cache" ("looked_up_at");
