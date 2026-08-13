-- 0054 — 계약별 납부계좌 지정 + 제11조 특약사항
--
-- 납부계좌: 계약서에 찍히는 입금 계좌를 지금까지는 payment_info 의 이름에서
-- 키워드("임대료" / "보증금")로 골라 왔다. 계약마다 다른 계좌를 쓰는 경우를
-- 담을 수 없어, 계약에 직접 지정 칸을 둔다. 비워 두면 예전처럼 자동으로
-- 고른 계좌가 나가므로 기존 계약의 발급 결과는 그대로다.
--
-- 특약사항: 계약서 본문 제11조(특약사항)의 내용은 계약마다 다르다. 템플릿에
-- 박아 두면 모든 계약이 남의 특약을 달고 나가므로, 계약에 적어 두고 제11조
-- 다음 줄에 이어 찍는다. 기존 terms_text 는 "본문 전체를 이 글로 대체" 하는
-- 이관 계약용 필드라 의미가 달라 건드리지 않고 새 칸을 만든다.
--
-- Additive only.
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "rent_payment_info_id" integer;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "deposit_payment_info_id" integer;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "special_terms" text;
