-- =============================================================================
-- tenants/metheim/content.seed.ja.sql
-- Metheim Yeosu — Japanese marketing content overlay (guest web + admin).
-- Translated from the finalized Korean seed (content.seed.ko.sql). Same 52 keys,
-- same DB-overlay mechanism, same exclusions (legal copy not included).
-- Brand lockups (Metheim / Metheim Yeosu) kept Latin; {{count}}/{{year}}/{{appName}} preserved.
--
-- APPLY TO THE METHEIM DB ONLY (Supabase: metheim / dhdjxweuushugqltjael):
--   psql "" -f tenants/metheim/content.seed.ja.sql
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
('ja', 'nav.links.forStudents', '入居案内', 'human'),
('ja', 'home.hero_tagline', 'Metheim Yeosu', 'human'),
('ja', 'home.hero_subtitle', 'ヨス（麗水）旧市街、自分だけの灯りがともるプレミアムコンパクトレジデンス', 'human'),
('ja', 'home.why.item1_desc', '1〜2人世帯や20〜30代の単身者が、Metheimのフル装備コンパクトレジデンスと行き届いた管理で、ヨス旧市街に自分だけの空間を手に入れます。', 'human'),
('ja', 'home.why.item2_title', '1〜2人世帯に合わせた設計', 'human'),
('ja', 'home.why.item2_desc', '旧市街の徒歩圏という立地、短期も長期も選べる柔軟な契約。ひとり暮らしに本当に必要なものだけを揃えました。', 'human'),
('ja', 'home.listing.title', 'Metheim ヨスの住戸', 'human'),
('ja', 'home.plans.m3_desc', '長く住む長期入居者に最も人気の選択肢です。月額料金より5%お得。', 'human'),
('ja', 'home.cta.tagline', 'ヨスの夜の海の灯りを映した都心型コンパクトレジデンス、Metheim Yeosu', 'human'),
('ja', 'footer.desc', 'ヨス旧市街の短期・長期の入居者のための、安全で整ったフル装備コンパクトレジデンスです。', 'human'),
('ja', 'footer.copyright', '© {{year}} Metheim Yeosu. 全著作権所有。', 'human'),
('ja', 'footer.serving', 'ヨス旧市街のヨンドン（連灯洞）、1〜2人世帯のための都心型コンパクトレジデンス', 'human'),
('ja', 'footer.for_students', '入居案内', 'human'),
('ja', 'search.rooms_in_melbourne', 'ヨスの住戸 {{count}}件', 'human'),
('ja', 'house_rules.link_student', '入居案内', 'human'),
('ja', 'stay_plan.p1_desc', '短期の滞在や、ヨスでの暮らしをまず体験してみたい方に適しています。', 'human'),
('ja', 'stay_plan.p2_desc', '数か月ヨスに滞在する会社員やプロジェクト勤務の方に最適です。', 'human'),
('ja', 'stay_plan.p3_desc', '長く住んで最も安い週額料金を求める長期利用者に最も人気の選択肢です。', 'human'),
('ja', 'about.intro_p1', 'Metheimは、ヨス（麗水）旧市街のコンパクトレジデンスを、1〜2人世帯にとって窮屈でなく温かい自分だけの空間にしたいという、シンプルな思いから始まりました。ひとり暮らしで、安全で快適、そして手頃な住まいを見つけるのがどれほど大変か、私たちはよく知っています。だから、私たちがお手伝いします。', 'human'),
('ja', 'about.intro_p3', '1か月から長期まで選べる入居プラン、ヨス旧市街のヨンドン（連灯洞）にあるフル装備のコンパクト住戸、そして入居期間中ずっと続く管理サポートをご用意しています。隠れた費用はなく、荷物だけ持ってお越しください。', 'human'),
('ja', 'about.t1_text', 'Metheimのおかげで、ヨスへの引っ越しがスムーズでした。旧市街の徒歩圏でぴったりの住戸をすぐに見つけられ、手続きもすべて簡単でした。初日からしっかりケアしてもらえていると感じました。', 'human'),
('ja', 'about.t2_text', 'ひとりで住む家を探すのが不安でしたが、Metheimは本当に楽でした。問い合わせにすぐ答えてくれて、住戸は写真そのままでした。強くおすすめします！', 'human'),
('ja', 'about.blog_sub', 'ヨス旧市街でのひとり暮らしに役立つヒントやガイド、ストーリー。', 'human'),
('ja', 'about.b1_title', 'ヨス旧市街で1〜2人世帯が暮らしやすい街 TOP5', 'human'),
('ja', 'about.b2_title', 'ヨス旧市街の暮らしを始める：入居チェックリスト', 'human'),
('ja', 'about.b3_title', 'ヨスをお得に楽しむ：無料＆リーズナブルな楽しみ方', 'human'),
('ja', 'student.hero_tagline', '短期・長期入居のご案内', 'human'),
('ja', 'student.hero_title', '入居案内', 'human'),
('ja', 'student.breadcrumb', '入居案内', 'human'),
('ja', 'student.welcome_label', 'ヨスへようこそ', 'human'),
('ja', 'student.intro_p1', '新しい街での始まりはわくわくするものですが、安全で手頃な自分だけの空間を探すことがストレスであってはいけません。Metheimは、ヨス旧市街で短期・長期の入居者が良い住戸を見つけられるようお手伝いします。', 'human'),
('ja', 'student.intro_p2', '旧市街の生活インフラや交通、地域コミュニティが近く、あなたの定着を最大限スムーズにお手伝いします。', 'human'),
('ja', 'student.intro_p3', '私たちの住戸はヨス旧市街のヨンドン（連灯洞）にあり、市場や商店街、バスターミナルが徒歩圏で、安全で整った住環境を備えています。', 'human'),
('ja', 'student.stat2_label', 'ヨス旧市街', 'human'),
('ja', 'student.benefits_title', 'ひとり暮らしに必要なすべて', 'human'),
('ja', 'student.b4_desc', 'ヨス旧市街の徒歩圏にあるフル装備の住戸：ヨンドン（連灯洞）をはじめとする生活便利エリア。', 'human'),
('ja', 'student.t2_text', 'ひとりで住む家が不安でしたが、Metheimがすべてをシンプルにしてくれました。問い合わせにすぐ答えてくれて、住戸は写真そのままでした。', 'human'),
('ja', 'student.university_placeholder', '例：勤務先または所属（任意）', 'human'),
('ja', 'agent.intro_p1', '不動産仲介、企業提携、または地域パートナーの方ですか？Metheimパートナーネットワークに参加して、お客様をヨス旧市街のプレミアムコンパクトレジデンスにつなぎ、手数料を受け取りましょう。', 'human'),
('ja', 'agent.intro_p2', '私たちは、ヨスで1〜2人世帯が家を探すときに直面する難しさをよく理解しています。確かな住戸、迅速な対応、スムーズな予約手続きで、旧市街のコンパクトレジデンスの最も信頼できる紹介パートナーです。', 'human'),
('ja', 'agent.b2_desc', 'ヨスと周辺地域の幅広い1〜2人世帯の需要にアクセスできます。', 'human'),
('ja', 'agent.t2_text', 'Metheimの強みは、速く明確な対応です。ヨスへ移ってきた方々が、ストレスなく良い住まいを見つけられました。', 'human'),
('ja', 'agent.client_students', '入居者', 'human'),
('ja', 'faq.cat5', '入居案内', 'human'),
('ja', 'faq.a3', 'はい、対面の内見と動画による内見の両方をご用意しています。ご都合のよい時間を予約するにはご連絡ください。遠方からお越しの方には、到着前に安心してご決断いただけるよう、詳しい動画内見をお届けします。', 'human'),
('ja', 'faq.q6', '短期・長期の入居者向けのサービスはありますか？', 'human'),
('ja', 'faq.a6', 'もちろんです。短期・長期の入居者が私たちの中心のお客様です。旧市街の徒歩圏という立地とフル装備の設計で、ヨスでの暮らしを最大限に快適に整えました。', 'human'),
('ja', 'auth.login_subtitle', 'ヨスの住戸を管理するにはログインしてください', 'human'),
('ja', 'auth.register_subtitle', 'ヨスの住戸を予約しましょう', 'human'),
('ja', 'homestay.home.why_heading', 'Metheimを選ぶ理由', 'human'),
('ja', 'blog.keywords_placeholder', 'ヨス コンパクトレジデンス、旧市街 ワンルーム、単身世帯、入居', 'human'),
('ja', 'website_content.seo_keywords_placeholder', 'ヨス コンパクトレジデンス、旧市街 ワンルーム、1〜2人世帯、都心型生活住宅、フル装備', 'human')

ON CONFLICT (lang, key) DO UPDATE
  SET value = EXCLUDED.value, source = 'human', updated_at = now();
