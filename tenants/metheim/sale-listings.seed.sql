-- =============================================================================
-- tenants/metheim/sale-listings.seed.sql
-- Metheim Yeosu — 4 SAMPLE 분양(pre-sale) / 판매(sale) listings for the /buy board.
--
-- These are demo units for the single-building "development" site so the /buy
-- board isn't empty. Structural fields are locale-independent; per-locale copy
-- (title/subtitle/location/price_label/description) lives in `translations`,
-- resolved server-side lang → ko → en. price_amount is KRW (drives the FX
-- reference breakdown); Metheim guest UI is pinned to ₩.
--
-- IDEMPOTENT: every sample row is tagged translations->>'_seed' = 'metheim-sample'
-- and deleted first, so re-running replaces the samples without duplicating.
-- The app only reads translations[<lang>], so the _seed marker is inert.
--
-- APPLY TO THE METHEIM DB ONLY (Supabase: metheim / dhdjxweuushugqltjael) —
-- NEVER the primary MillionStay DB:
--   psql "$METHEIM_DATABASE_URL" -f tenants/metheim/sale-listings.seed.sql
-- =============================================================================

BEGIN;

-- Remove any previous run of these samples (keeps real admin-created rows).
DELETE FROM sale_listings WHERE translations->>'_seed' = 'metheim-sample';

INSERT INTO sale_listings
  (category, status, cover_image, gallery, area_m2, bedrooms, bathrooms, price_amount, sort_order, published, translations)
VALUES
-- 1) 스튜디오 A타입 — 분양 / 입주가능
(
  'presale', 'available',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
  '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
  23.10, 1, 1, 128000000, 1, true,
  '{
    "_seed": "metheim-sample",
    "ko": {"title": "스튜디오 A타입 · 23㎡", "subtitle": "1인 가구를 위한 컴팩트 원룸", "location": "여수 원도심 · 연등동", "price_label": "분양가 1억 2,800만원", "description": "채광과 수납을 살린 23㎡ 원룸입니다. 원도심 생활 인프라를 도보권에 두고, 1인 가구가 바로 입주할 수 있도록 마감했습니다."},
    "en": {"title": "Studio Type A · 23㎡", "subtitle": "A compact studio for solo living", "location": "Yeondeung-dong, Yeosu", "price_label": "₩128,000,000", "description": "A 23㎡ studio designed around daylight and storage. Downtown amenities within walking distance, finished and ready for move-in."},
    "ja": {"title": "スタジオ Aタイプ · 23㎡", "subtitle": "一人暮らしのためのコンパクトなワンルーム", "location": "麗水 旧都心 · 蓮登洞", "price_label": "分譲価格 1億2,800万ウォン", "description": "採光と収納を活かした23㎡のワンルームです。旧都心の生活インフラが徒歩圏、すぐに入居できる仕上がりです。"},
    "zh": {"title": "开间 A户型 · 23㎡", "subtitle": "为单身生活打造的紧凑开间", "location": "丽水老城 · 莲登洞", "price_label": "销售价 1亿2,800万韩元", "description": "23㎡开间，注重采光与收纳。老城生活配套步行可达，交付即可入住。"},
    "th": {"title": "สตูดิโอ Type A · 23㎡", "subtitle": "สตูดิโอกะทัดรัดสำหรับอยู่คนเดียว", "location": "ยอนดึงดง เมืองเก่ายอซู", "price_label": "ราคาขาย 128,000,000 วอน", "description": "สตูดิโอ 23㎡ เน้นแสงธรรมชาติและพื้นที่จัดเก็บ สิ่งอำนวยความสะดวกในเมืองเก่าเดินถึง พร้อมเข้าอยู่ทันที"},
    "vi": {"title": "Studio Type A · 23㎡", "subtitle": "Căn studio gọn gàng cho người ở một mình", "location": "Yeondeung-dong, Yeosu", "price_label": "Giá bán 128.000.000 won", "description": "Căn studio 23㎡ chú trọng ánh sáng và không gian lưu trữ. Tiện ích khu phố cổ trong tầm đi bộ, bàn giao là dọn vào ngay."}
  }'::jsonb
),
-- 2) 1.5룸 B타입 — 분양 / 입주가능
(
  'presale', 'available',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
  '["https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
  33.00, 1, 1, 168000000, 2, true,
  '{
    "_seed": "metheim-sample",
    "ko": {"title": "1.5룸 B타입 · 33㎡", "subtitle": "침실과 거실을 나눈 1.5룸", "location": "여수 원도심 · 연등동", "price_label": "분양가 1억 6,800만원", "description": "잠자는 공간과 생활 공간을 분리한 33㎡ 1.5룸입니다. 재택근무와 휴식을 한 집에서 편안하게 나눌 수 있습니다."},
    "en": {"title": "1.5-Room Type B · 33㎡", "subtitle": "A 1.5-room with a separate sleeping nook", "location": "Yeondeung-dong, Yeosu", "price_label": "₩168,000,000", "description": "A 33㎡ 1.5-room that separates sleeping from living — comfortable for both remote work and rest."},
    "ja": {"title": "1.5ルーム Bタイプ · 33㎡", "subtitle": "寝室とリビングを分けた1.5ルーム", "location": "麗水 旧都心 · 蓮登洞", "price_label": "分譲価格 1億6,800万ウォン", "description": "寝る空間と暮らす空間を分けた33㎡の1.5ルームです。在宅ワークと休息を一つの家で快適に分けられます。"},
    "zh": {"title": "1.5居室 B户型 · 33㎡", "subtitle": "卧室与客厅分区的1.5居室", "location": "丽水老城 · 莲登洞", "price_label": "销售价 1亿6,800万韩元", "description": "33㎡的1.5居室，将睡眠区与生活区分开，居家办公与休息在同一屋檐下都从容。"},
    "th": {"title": "1.5 ห้อง Type B · 33㎡", "subtitle": "1.5 ห้องที่แยกมุมนอนออกจากห้องนั่งเล่น", "location": "ยอนดึงดง เมืองเก่ายอซู", "price_label": "ราคาขาย 168,000,000 วอน", "description": "1.5 ห้อง ขนาด 33㎡ แยกพื้นที่นอนออกจากพื้นที่นั่งเล่น ทำงานที่บ้านและพักผ่อนในบ้านหลังเดียวได้สบาย"},
    "vi": {"title": "Căn 1.5 phòng Type B · 33㎡", "subtitle": "Căn 1.5 phòng có góc ngủ riêng", "location": "Yeondeung-dong, Yeosu", "price_label": "Giá bán 168.000.000 won", "description": "Căn 1.5 phòng 33㎡ tách khu ngủ khỏi khu sinh hoạt — thoải mái cho cả làm việc tại nhà lẫn nghỉ ngơi."}
  }'::jsonb
),
-- 3) 투룸 C타입 — 판매 / 예약중
(
  'sale', 'reserved',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
  '["https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
  45.50, 2, 1, 235000000, 3, true,
  '{
    "_seed": "metheim-sample",
    "ko": {"title": "투룸 C타입 · 45㎡", "subtitle": "2인 가구에 알맞은 투룸", "location": "여수 원도심 · 연등동", "price_label": "매매가 2억 3,500만원", "description": "방 두 개를 갖춘 45㎡ 투룸입니다. 신혼부부나 룸메이트 조합에 알맞고, 현재 예약 상담이 진행 중입니다."},
    "en": {"title": "Two-Room Type C · 45㎡", "subtitle": "A two-room that fits couples and sharers", "location": "Yeondeung-dong, Yeosu", "price_label": "₩235,000,000", "description": "A 45㎡ two-room with two separate bedrooms — ideal for couples or sharers. Currently under reservation."},
    "ja": {"title": "2ルーム Cタイプ · 45㎡", "subtitle": "二人暮らしに程よい2ルーム", "location": "麗水 旧都心 · 蓮登洞", "price_label": "販売価格 2億3,500万ウォン", "description": "部屋を二つ備えた45㎡の2ルームです。新婚夫婦やルームメイトに程よく、現在は予約相談を受付中です。"},
    "zh": {"title": "两居室 C户型 · 45㎡", "subtitle": "适合两人居住的两居室", "location": "丽水老城 · 莲登洞", "price_label": "出售价 2亿3,500万韩元", "description": "45㎡两居室，配两间独立卧室，适合新婚夫妇或合租，目前正在预约洽谈中。"},
    "th": {"title": "สองห้องนอน Type C · 45㎡", "subtitle": "สองห้องนอนที่พอดีสำหรับสองคน", "location": "ยอนดึงดง เมืองเก่ายอซู", "price_label": "ราคาขาย 235,000,000 วอน", "description": "สองห้องนอน ขนาด 45㎡ มีห้องนอนแยกสองห้อง เหมาะกับคู่รักหรือเพื่อนร่วมห้อง ขณะนี้อยู่ระหว่างการจอง"},
    "vi": {"title": "Căn hai phòng Type C · 45㎡", "subtitle": "Căn hai phòng vừa vặn cho hai người", "location": "Yeondeung-dong, Yeosu", "price_label": "Giá bán 235.000.000 won", "description": "Căn hai phòng 45㎡ với hai phòng ngủ riêng — lý tưởng cho cặp đôi hoặc ở ghép. Hiện đang trong quá trình giữ chỗ."}
  }'::jsonb
),
-- 4) 복층 스튜디오 D타입 — 판매 / 입주가능
(
  'sale', 'available',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
  '["https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
  39.60, 1, 1, 198000000, 4, true,
  '{
    "_seed": "metheim-sample",
    "ko": {"title": "복층 스튜디오 D타입 · 40㎡", "subtitle": "높은 층고의 복층형 주거", "location": "여수 원도심 · 연등동", "price_label": "매매가 1억 9,800만원", "description": "층고를 살린 40㎡ 복층 스튜디오입니다. 아래층은 생활 공간, 위층은 침실로 나눠 좁지 않게 활용할 수 있습니다."},
    "en": {"title": "Loft Studio Type D · 40㎡", "subtitle": "A loft-style home with soaring ceilings", "location": "Yeondeung-dong, Yeosu", "price_label": "₩198,000,000", "description": "A 40㎡ loft studio that makes the most of its height — living below, sleeping above, never cramped."},
    "ja": {"title": "メゾネット スタジオ Dタイプ · 40㎡", "subtitle": "天井の高いメゾネット型住居", "location": "麗水 旧都心 · 蓮登洞", "price_label": "販売価格 1億9,800万ウォン", "description": "天井高を活かした40㎡のメゾネットスタジオです。下階は生活空間、上階は寝室に分け、狭さを感じさせず使えます。"},
    "zh": {"title": "复式开间 D户型 · 40㎡", "subtitle": "层高出众的复式住宅", "location": "丽水老城 · 莲登洞", "price_label": "出售价 1亿9,800万韩元", "description": "40㎡复式开间，充分利用层高。下层为生活区、上层为卧室，划分之后毫不局促。"},
    "th": {"title": "สตูดิโอลอฟท์ Type D · 40㎡", "subtitle": "ที่พักแบบลอฟท์เพดานสูง", "location": "ยอนดึงดง เมืองเก่ายอซู", "price_label": "ราคาขาย 198,000,000 วอน", "description": "สตูดิโอลอฟท์ ขนาด 40㎡ ใช้ประโยชน์จากความสูงเพดาน ชั้นล่างเป็นพื้นที่ใช้สอย ชั้นบนเป็นห้องนอน ใช้งานได้ไม่อึดอัด"},
    "vi": {"title": "Studio gác lửng Type D · 40㎡", "subtitle": "Không gian gác lửng trần cao", "location": "Yeondeung-dong, Yeosu", "price_label": "Giá bán 198.000.000 won", "description": "Studio gác lửng 40㎡ tận dụng chiều cao trần. Tầng dưới là khu sinh hoạt, tầng trên là phòng ngủ, phân chia rồi vẫn rộng rãi."}
  }'::jsonb
);

COMMIT;

-- Verify:
--   SELECT id, category, status, price_amount, translations->'ko'->>'title' AS ko_title
--   FROM sale_listings WHERE translations->>'_seed' = 'metheim-sample' ORDER BY sort_order;
