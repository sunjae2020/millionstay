-- =============================================================================
-- tenants/metheim/sale-listings.seed.sql
-- MetHeim Yeosu — 6 SAMPLE 분양(pre-sale) / 판매(sale) listings for the /buy board.
--
-- These are demo units for the single-building "development" site so the /buy
-- board isn't empty. Structural fields are locale-independent; per-locale copy
-- (title/subtitle/location/price_label/description) lives in `translations`,
-- resolved server-side lang → ko → en. price_amount is KRW (drives the FX
-- reference breakdown); MetHeim guest UI is pinned to ₩.
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
),
-- 5) 테라스 1.5룸 E타입 — 분양 / 입주가능
(
  'presale', 'available',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
  36.00, 1, 1, 178000000, 5, true,
  '{
    "_seed": "metheim-sample",
    "ko": {"title": "테라스 1.5룸 E타입 · 36㎡", "subtitle": "작은 테라스가 있는 1.5룸", "location": "여수 원도심 · 연등동", "price_label": "분양가 1억 7,800만원", "description": "전용 테라스를 갖춘 36㎡ 1.5룸입니다. 바깥 공기를 집 안으로 들이며, 화분을 놓거나 간단한 티타임을 즐기기 좋습니다."},
    "en": {"title": "1.5-Room Type E · 36㎡", "subtitle": "A 1.5-room with a small terrace", "location": "Yeondeung-dong, Yeosu", "price_label": "₩178,000,000", "description": "A 36㎡ 1.5-room with a private terrace — bring the outdoors in, with room for plants or a quiet cup of tea."},
    "ja": {"title": "テラス付き1.5ルーム Eタイプ · 36㎡", "subtitle": "小さなテラスのある1.5ルーム", "location": "麗水 旧都心 · 蓮登洞", "price_label": "分譲価格 1億7,800万ウォン", "description": "専用テラスを備えた36㎡の1.5ルームです。外の空気を室内に取り込み、植木やちょっとしたティータイムにも最適です。"},
    "zh": {"title": "露台1.5居室 E户型 · 36㎡", "subtitle": "带小露台的1.5居室", "location": "丽水老城 · 莲登洞", "price_label": "销售价 1亿7,800万韩元", "description": "36㎡的1.5居室，配私家露台，将户外空气引入室内，摆放绿植或享受片刻茶歇都很惬意。"},
    "th": {"title": "1.5 ห้องมีระเบียง Type E · 36㎡", "subtitle": "1.5 ห้องพร้อมระเบียงเล็ก", "location": "ยอนดึงดง เมืองเก่ายอซู", "price_label": "ราคาขาย 178,000,000 วอน", "description": "1.5 ห้อง ขนาด 36㎡ พร้อมระเบียงส่วนตัว รับอากาศภายนอกเข้าบ้าน วางกระถางต้นไม้หรือจิบชาเบา ๆ ได้สบาย"},
    "vi": {"title": "Căn 1.5 phòng có ban công Type E · 36㎡", "subtitle": "Căn 1.5 phòng với ban công nhỏ", "location": "Yeondeung-dong, Yeosu", "price_label": "Giá bán 178.000.000 won", "description": "Căn 1.5 phòng 36㎡ có ban công riêng — đưa không khí bên ngoài vào nhà, đủ chỗ đặt cây hay nhâm nhi tách trà."}
  }'::jsonb
),
-- 6) 펜트 스튜디오 F타입 — 판매 / 판매완료(sold)
(
  'sale', 'sold',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80',
  '["https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80","https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=80"]'::jsonb,
  52.00, 1, 1, 260000000, 6, true,
  '{
    "_seed": "metheim-sample",
    "ko": {"title": "펜트 스튜디오 F타입 · 52㎡", "subtitle": "최상층 전망의 펜트 스튜디오", "location": "여수 원도심 · 연등동", "price_label": "매매가 2억 6,000만원", "description": "건물 최상층에 자리한 52㎡ 스튜디오입니다. 탁 트인 전망과 넉넉한 층고로 여유로운 1~2인 생활을 완성합니다. (현재 판매가 완료된 세대입니다.)"},
    "en": {"title": "Penthouse Studio Type F · 52㎡", "subtitle": "A top-floor penthouse studio", "location": "Yeondeung-dong, Yeosu", "price_label": "₩260,000,000", "description": "A 52㎡ studio on the top floor. Open views and generous ceiling height for relaxed one-to-two-person living. (This unit has been sold.)"},
    "ja": {"title": "ペントハウス スタジオ Fタイプ · 52㎡", "subtitle": "最上階の眺望を備えたペントスタジオ", "location": "麗水 旧都心 · 蓮登洞", "price_label": "販売価格 2億6,000万ウォン", "description": "建物最上階に位置する52㎡のスタジオです。開けた眺望とゆとりある天井高で、1〜2人の余裕ある暮らしを叶えます。（本住戸は販売終了です。）"},
    "zh": {"title": "顶层开间 F户型 · 52㎡", "subtitle": "享顶层视野的顶层开间", "location": "丽水老城 · 莲登洞", "price_label": "出售价 2亿6,000万韩元", "description": "位于建筑顶层的52㎡开间。开阔视野与充裕层高，成就1~2人从容生活。（本户已售出。）"},
    "th": {"title": "สตูดิโอเพนต์เฮาส์ Type F · 52㎡", "subtitle": "สตูดิโอเพนต์เฮาส์ชั้นบนสุดพร้อมวิว", "location": "ยอนดึงดง เมืองเก่ายอซู", "price_label": "ราคาขาย 260,000,000 วอน", "description": "สตูดิโอ 52㎡ บนชั้นบนสุดของอาคาร วิวโล่งและเพดานสูง ตอบโจทย์การอยู่อาศัย 1-2 คนอย่างสบาย (ยูนิตนี้ขายแล้ว)"},
    "vi": {"title": "Studio penthouse Type F · 52㎡", "subtitle": "Studio penthouse tầng cao nhất có tầm nhìn", "location": "Yeondeung-dong, Yeosu", "price_label": "Giá bán 260.000.000 won", "description": "Studio 52㎡ ở tầng cao nhất tòa nhà. Tầm nhìn thoáng và trần cao rộng rãi cho cuộc sống 1-2 người thư thái. (Căn này đã được bán.)"}
  }'::jsonb
);

COMMIT;

-- Verify:
--   SELECT id, category, status, price_amount, translations->'ko'->>'title' AS ko_title
--   FROM sale_listings WHERE translations->>'_seed' = 'metheim-sample' ORDER BY sort_order;
