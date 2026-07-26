-- =============================================================================
-- tenants/metheim/content.seed.vi.sql
-- Metheim Yeosu — Vietnamese marketing content overlay (guest web + admin).
-- Translated from the finalized Korean seed (content.seed.ko.sql). Same 52 keys,
-- same DB-overlay mechanism, same exclusions (legal copy not included).
-- Brand lockups (Metheim / Metheim Yeosu) kept Latin; {{count}}/{{year}}/{{appName}} preserved.
--
-- APPLY TO THE METHEIM DB ONLY (Supabase: metheim / dhdjxweuushugqltjael):
--   psql "" -f tenants/metheim/content.seed.vi.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS translations (
  id serial PRIMARY KEY,
  lang text NOT NULL,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'human',
  updated_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT translations_lang_key_uq UNIQUE (lang, key)
);

INSERT INTO translations (lang, key, value, source) VALUES
('vi', 'nav.links.forStudents', 'Hướng dẫn thuê nhà', 'human'),
('vi', 'home.hero_tagline', 'Metheim Yeosu', 'human'),
('vi', 'home.hero_subtitle', 'Trung tâm cũ Yeosu — căn hộ nhỏ cao cấp nơi ánh đèn riêng của bạn bừng sáng', 'human'),
('vi', 'home.why.item1_desc', 'Hộ 1–2 người và người độc thân ở độ tuổi 20–30 tạo cho mình một không gian riêng tại trung tâm cũ Yeosu nhờ căn hộ nhỏ đầy đủ nội thất và dịch vụ quản lý chỉn chu của Metheim.', 'human'),
('vi', 'home.why.item2_title', 'Thiết kế riêng cho hộ 1–2 người', 'human'),
('vi', 'home.why.item2_desc', 'Vị trí đi bộ được trong trung tâm cũ, hợp đồng linh hoạt cho cả thuê ngắn hạn và dài hạn. Chỉ giữ lại những gì thật sự cần cho cuộc sống một mình.', 'human'),
('vi', 'home.listing.title', 'Phòng Metheim Yeosu', 'human'),
('vi', 'home.plans.m3_desc', 'Lựa chọn được ưa chuộng nhất cho người thuê dài hạn ở lâu. Tiết kiệm 5% so với giá theo tháng.', 'human'),
('vi', 'home.cta.tagline', 'Căn hộ nhỏ giữa lòng thành phố mang ánh đèn biển đêm Yeosu, Metheim Yeosu', 'human'),
('vi', 'footer.desc', 'Căn hộ nhỏ đầy đủ nội thất, an toàn và ngăn nắp dành cho người thuê ngắn hạn và dài hạn tại trung tâm cũ Yeosu.', 'human'),
('vi', 'footer.copyright', '© {{year}} Metheim Yeosu. Bảo lưu mọi quyền.', 'human'),
('vi', 'footer.serving', 'Phường Yeondeung, khu phố cổ Yeosu — căn hộ nhỏ giữa lòng thành phố cho hộ 1–2 người', 'human'),
('vi', 'footer.for_students', 'Hướng dẫn thuê nhà', 'human'),
('vi', 'search.rooms_in_melbourne', '{{count}} phòng tại Yeosu', 'human'),
('vi', 'house_rules.link_student', 'Hướng dẫn thuê nhà', 'human'),
('vi', 'stay_plan.p1_desc', 'Phù hợp với người lưu trú ngắn hạn hoặc muốn trải nghiệm cuộc sống ở Yeosu trước.', 'human'),
('vi', 'stay_plan.p2_desc', 'Lý tưởng cho người đi làm hoặc làm dự án lưu lại Yeosu vài tháng.', 'human'),
('vi', 'stay_plan.p3_desc', 'Lựa chọn được ưa chuộng nhất cho người thuê dài hạn ở lâu và muốn mức giá theo tuần thấp nhất.', 'human'),
('vi', 'about.intro_p1', 'Metheim bắt đầu từ một suy nghĩ đơn giản: biến căn hộ nhỏ ở trung tâm cũ Yeosu thành không gian riêng ấm áp, không tù túng cho hộ 1–2 người. Chúng tôi hiểu việc tìm một chỗ ở an toàn, thoải mái và hợp lý khi sống một mình khó khăn đến thế nào. Vì vậy chúng tôi ở đây để giúp bạn.', 'human'),
('vi', 'about.intro_p3', 'Chúng tôi cung cấp các gói lưu trú từ một tháng đến dài hạn, phòng nhỏ đầy đủ nội thất tại phường Yeondeung, khu phố cổ Yeosu, cùng hỗ trợ quản lý suốt thời gian bạn ở. Không có chi phí ẩn — bạn chỉ cần xách hành lý đến.', 'human'),
('vi', 'about.t1_text', 'Nhờ Metheim, việc chuyển đến Yeosu diễn ra suôn sẻ. Tôi nhanh chóng tìm được phòng vừa ý trong khu đi bộ được ở trung tâm cũ và mọi thủ tục đều đơn giản. Ngay từ ngày đầu tôi đã thấy mình được chăm sóc chu đáo.', 'human'),
('vi', 'about.t2_text', 'Tôi từng lo lắng khi tìm nhà để sống một mình, nhưng Metheim thật sự dễ chịu. Họ trả lời thắc mắc rất nhanh và phòng đúng y như trong ảnh. Rất đáng để giới thiệu!', 'human'),
('vi', 'about.blog_sub', 'Mẹo, hướng dẫn và những câu chuyện hữu ích cho cuộc sống một mình ở trung tâm cũ Yeosu.', 'human'),
('vi', 'about.b1_title', 'TOP 5 khu phố đáng sống cho hộ 1–2 người ở trung tâm cũ Yeosu', 'human'),
('vi', 'about.b2_title', 'Bắt đầu cuộc sống ở trung tâm cũ Yeosu: Danh sách kiểm tra khi dọn vào', 'human'),
('vi', 'about.b3_title', 'Tận hưởng Yeosu tiết kiệm: Những trải nghiệm miễn phí & giá rẻ', 'human'),
('vi', 'student.hero_tagline', 'Hướng dẫn thuê ngắn hạn và dài hạn', 'human'),
('vi', 'student.hero_title', 'Hướng dẫn thuê nhà', 'human'),
('vi', 'student.breadcrumb', 'Hướng dẫn thuê nhà', 'human'),
('vi', 'student.welcome_label', 'Chào mừng bạn đến Yeosu', 'human'),
('vi', 'student.intro_p1', 'Khởi đầu ở một thành phố mới thật háo hức, nhưng việc tìm một không gian riêng an toàn và hợp lý không nên khiến bạn căng thẳng. Metheim giúp người thuê ngắn hạn và dài hạn tìm được phòng tốt tại trung tâm cũ Yeosu.', 'human'),
('vi', 'student.intro_p2', 'Hạ tầng sinh hoạt, giao thông và cộng đồng địa phương ở trung tâm cũ đều gần kề, giúp bạn ổn định cuộc sống suôn sẻ nhất có thể.', 'human'),
('vi', 'student.intro_p3', 'Các phòng của chúng tôi nằm ở phường Yeondeung, khu phố cổ Yeosu, đi bộ được đến chợ, khu mua sắm và bến xe buýt, với môi trường sống an toàn và ngăn nắp.', 'human'),
('vi', 'student.stat2_label', 'Trung tâm cũ Yeosu', 'human'),
('vi', 'student.benefits_title', 'Mọi thứ bạn cần cho cuộc sống một mình', 'human'),
('vi', 'student.b4_desc', 'Phòng đầy đủ nội thất trong khu đi bộ được ở trung tâm cũ Yeosu: phường Yeondeung và các khu vực tiện lợi khác.', 'human'),
('vi', 'student.t2_text', 'Tôi từng lo lắng về việc sống một mình, nhưng Metheim đã làm mọi thứ trở nên đơn giản. Họ trả lời thắc mắc rất nhanh và phòng đúng y như trong ảnh.', 'human'),
('vi', 'student.university_placeholder', 'Ví dụ: nơi làm việc hoặc đơn vị (không bắt buộc)', 'human'),
('vi', 'agent.intro_p1', 'Bạn là môi giới bất động sản, đối tác doanh nghiệp hay đối tác địa phương? Hãy tham gia mạng lưới đối tác Metheim để kết nối khách hàng với căn hộ nhỏ cao cấp ở trung tâm cũ Yeosu và nhận hoa hồng.', 'human'),
('vi', 'agent.intro_p2', 'Chúng tôi hiểu rõ những khó khăn mà hộ 1–2 người gặp phải khi tìm nhà ở Yeosu. Với phòng đã được kiểm chứng, phản hồi nhanh và quy trình đặt phòng mượt mà, chúng tôi là đối tác giới thiệu đáng tin cậy nhất cho căn hộ nhỏ ở trung tâm cũ.', 'human'),
('vi', 'agent.b2_desc', 'Tiếp cận nhu cầu rộng lớn của các hộ 1–2 người tại Yeosu và khu vực lân cận.', 'human'),
('vi', 'agent.t2_text', 'Điểm mạnh của Metheim là phản hồi nhanh và rõ ràng. Những người chuyển đến Yeosu đã tìm được nhà tốt mà không hề căng thẳng.', 'human'),
('vi', 'agent.client_students', 'Người thuê', 'human'),
('vi', 'faq.cat5', 'Hướng dẫn thuê nhà', 'human'),
('vi', 'faq.a3', 'Có, chúng tôi cung cấp cả tham quan trực tiếp lẫn tham quan qua video. Hãy liên hệ để đặt lịch vào thời gian thuận tiện. Với những bạn ở xa, chúng tôi gửi video tham quan chi tiết để bạn yên tâm quyết định trước khi đến.', 'human'),
('vi', 'faq.q6', 'Có dịch vụ nào dành cho người thuê ngắn hạn và dài hạn không?', 'human'),
('vi', 'faq.a6', 'Tất nhiên rồi. Người thuê ngắn hạn và dài hạn chính là khách hàng cốt lõi của chúng tôi. Với vị trí đi bộ được ở trung tâm cũ và thiết kế đầy đủ nội thất, chúng tôi đã chuẩn bị để cuộc sống ở Yeosu của bạn thoải mái nhất có thể.', 'human'),
('vi', 'auth.login_subtitle', 'Đăng nhập để quản lý phòng tại Yeosu', 'human'),
('vi', 'auth.register_subtitle', 'Đặt phòng tại Yeosu', 'human'),
('vi', 'homestay.home.why_heading', 'Lý do chọn Metheim', 'human'),
('vi', 'blog.keywords_placeholder', 'căn hộ nhỏ Yeosu, phòng đơn trung tâm cũ, hộ một người, thuê nhà', 'human'),
('vi', 'website_content.seo_keywords_placeholder', 'căn hộ nhỏ Yeosu, phòng đơn trung tâm cũ, hộ 1–2 người, nhà ở đô thị, đầy đủ nội thất', 'human')

ON CONFLICT (lang, key) DO UPDATE
  SET value = EXCLUDED.value, source = 'human', updated_at = now();
