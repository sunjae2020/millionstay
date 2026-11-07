-- 0100 숙박 상품(accommodation_catalog)에 소프트 삭제 칸을 더한다
--
-- 서비스 카탈로그(service_catalog.deleted_at)와 같은 보관함 흐름을 상품 리스트에도
-- 붙인다 — 체크박스 선택 → 보관(소프트 삭제) / 복원 / 영구 삭제, 그리고 보관함 보기.
-- 지금까지 DELETE /v1/accommodations/:id 는 행을 바로 지웠다.
--
-- NULL = 살아 있는 상품. 기존 행은 모두 NULL 로 남는다 — 백필 없음.
-- Metheim 운영 DB 에는 이미 이 칸이 있다(IF NOT EXISTS 로 그대로 통과).

ALTER TABLE accommodation_catalog ADD COLUMN IF NOT EXISTS deleted_at timestamp;
