-- =============================================================================
-- tenants/metheim/content.seed.zh.sql
-- Metheim Yeosu — Simplified Chinese marketing content overlay (guest web + admin).
-- Translated from the finalized Korean seed (content.seed.ko.sql). Same 52 keys,
-- same DB-overlay mechanism, same exclusions (legal copy not included).
-- Brand lockups (Metheim / Metheim Yeosu) kept Latin; {{count}}/{{year}}/{{appName}} preserved.
--
-- APPLY TO THE METHEIM DB ONLY (Supabase: metheim / dhdjxweuushugqltjael):
--   psql "" -f tenants/metheim/content.seed.zh.sql
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
('zh', 'nav.links.forStudents', '入住指南', 'human'),
('zh', 'home.hero_tagline', 'Metheim Yeosu', 'human'),
('zh', 'home.hero_subtitle', '丽水老城区，点亮专属灯火的高端小户型住宅', 'human'),
('zh', 'home.why.item1_desc', '1–2人家庭与20–30岁单身人士，凭借 Metheim 的全装小户型与规整管理，在丽水老城区拥有专属空间。', 'human'),
('zh', 'home.why.item2_title', '1–2人家庭定制设计', 'human'),
('zh', 'home.why.item2_desc', '老城区步行可达的位置，兼顾短期与长期的灵活合约。只保留独居生活真正需要的一切。', 'human'),
('zh', 'home.listing.title', 'Metheim 丽水房型', 'human'),
('zh', 'home.plans.m3_desc', '最受长期入住者欢迎的选择。相比月租可省 5%。', 'human'),
('zh', 'home.cta.tagline', '承载丽水夜海灯火的都市小户型住宅，Metheim Yeosu', 'human'),
('zh', 'footer.desc', '为丽水老城区的短期与长期入住者打造的安全、规整的全装小户型住宅。', 'human'),
('zh', 'footer.copyright', '© {{year}} Metheim Yeosu. 保留所有权利。', 'human'),
('zh', 'footer.serving', '丽水老城区莲灯洞，为1–2人家庭打造的都市小户型住宅', 'human'),
('zh', 'footer.for_students', '入住指南', 'human'),
('zh', 'search.rooms_in_melbourne', '丽水房型 {{count}} 间', 'human'),
('zh', 'house_rules.link_student', '入住指南', 'human'),
('zh', 'stay_plan.p1_desc', '适合短期停留或想先体验丽水生活的人。', 'human'),
('zh', 'stay_plan.p2_desc', '适合在丽水停留数月的上班族或项目工作者。', 'human'),
('zh', 'stay_plan.p3_desc', '最受希望长期居住、追求最低周租的长期入住者欢迎的选择。', 'human'),
('zh', 'about.intro_p1', 'Metheim 源于一个简单的想法：把丽水老城区的小户型，变成1–2人家庭不压抑、有温度的专属空间。我们深知独居生活中，找到安全、舒适又实惠的家有多难。所以，交给我们。', 'human'),
('zh', 'about.intro_p3', '我们提供从一个月到长期可选的居住方案、丽水老城区莲灯洞的全装小户型房间，以及贯穿整个入住期的管理支持。没有隐藏费用，只需带上行李入住。', 'human'),
('zh', 'about.t1_text', '多亏 Metheim，搬来丽水的过程很顺利。我很快就在老城区步行范围内找到合适的房间，所有手续都很简单。从第一天起就感觉被照顾得很好。', 'human'),
('zh', 'about.t2_text', '本来还担心独自找房，Metheim 真的很省心。咨询回复很快，房间和照片一模一样。强烈推荐！', 'human'),
('zh', 'about.blog_sub', '关于在丽水老城区独居生活的实用贴士、指南与故事。', 'human'),
('zh', 'about.b1_title', '丽水老城区最适合1–2人家庭居住的五大社区', 'human'),
('zh', 'about.b2_title', '开启丽水老城区生活：入住清单', 'human'),
('zh', 'about.b3_title', '省钱畅玩丽水：免费与实惠的好去处', 'human'),
('zh', 'student.hero_tagline', '短期与长期入住指南', 'human'),
('zh', 'student.hero_title', '入住指南', 'human'),
('zh', 'student.breadcrumb', '入住指南', 'human'),
('zh', 'student.welcome_label', '欢迎来到丽水', 'human'),
('zh', 'student.intro_p1', '在新城市开启生活令人期待，但寻找安全又实惠的专属空间不该成为压力。Metheim 帮助短期与长期入住者在丽水老城区找到合适的房间。', 'human'),
('zh', 'student.intro_p2', '老城区的生活配套、交通与本地社区近在咫尺，让你的落脚尽可能顺利。', 'human'),
('zh', 'student.intro_p3', '我们的房间位于丽水老城区莲灯洞，步行即可到达市场、商圈与汽车客运站，居住环境安全而规整。', 'human'),
('zh', 'student.stat2_label', '丽水老城区', 'human'),
('zh', 'student.benefits_title', '独居生活所需的一切', 'human'),
('zh', 'student.b4_desc', '丽水老城区步行可达的全装房间：涵盖莲灯洞等生活便利区域。', 'human'),
('zh', 'student.t2_text', '本来担心独自找房，Metheim 把一切都变得很简单。咨询回复很快，房间和照片一模一样。', 'human'),
('zh', 'student.university_placeholder', '例如：工作地点或所属单位（选填）', 'human'),
('zh', 'agent.intro_p1', '您是房产中介、企业合作方或本地伙伴吗？加入 Metheim 合作伙伴网络，为客户对接丽水老城区的高端小户型住宅，并赚取佣金。', 'human'),
('zh', 'agent.intro_p2', '我们深知1–2人家庭在丽水找房时的种种不易。凭借经过核验的房间、快速的响应与顺畅的预订流程，我们是老城区小户型住宅最值得信赖的推介伙伴。', 'human'),
('zh', 'agent.b2_desc', '触达丽水及周边地区广泛的1–2人家庭需求。', 'human'),
('zh', 'agent.t2_text', 'Metheim 的优势在于快速而清晰的响应。搬来丽水的人都毫无压力地找到了好房子。', 'human'),
('zh', 'agent.client_students', '入住者', 'human'),
('zh', 'faq.cat5', '入住指南', 'human'),
('zh', 'faq.a3', '是的，我们同时提供实地看房和视频看房。请联系我们预约方便的时间。对于远道而来的人，我们会提供详尽的视频看房，让您在抵达前就能安心做决定。', 'human'),
('zh', 'faq.q6', '有面向短期与长期入住者的服务吗？', 'human'),
('zh', 'faq.a6', '当然。短期与长期入住者正是我们的核心客户。凭借老城区步行可达的位置与全装设计，我们让丽水生活尽可能舒适省心。', 'human'),
('zh', 'auth.login_subtitle', '登录以管理您的丽水房型', 'human'),
('zh', 'auth.register_subtitle', '预订您在丽水的房型', 'human'),
('zh', 'homestay.home.why_heading', '选择 Metheim 的理由', 'human'),
('zh', 'blog.keywords_placeholder', '丽水小户型住宅, 老城区单间公寓, 单身家庭, 入住', 'human'),
('zh', 'website_content.seo_keywords_placeholder', '丽水小户型住宅, 老城区单间公寓, 1–2人家庭, 都市生活住宅, 全装', 'human')

ON CONFLICT (lang, key) DO UPDATE
  SET value = EXCLUDED.value, source = 'human', updated_at = now();
