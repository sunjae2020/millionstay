-- =============================================================================
-- tenants/metheim/content.seed.ko.sql
-- Metheim Yeosu — Korean MARKETING content overlay for the guest web + admin.
--
-- HOW IT WORKS. The guest app bundles MillionStay's Korean copy as the offline
-- default, then overlays DB-managed strings from `/api/v1/public/translations/ko`
-- on top (artifacts/million-stay-web/src/i18n/index.ts). This seed writes those
-- overlay rows into the Metheim DB, so Metheim reads as "여수 · 1~2인 가구 · 소형
-- 주거" WITHOUT touching the shared source — the primary MillionStay instance,
-- which has its own DB, keeps its Melbourne/유학생 copy untouched.
--
-- SOURCE OF TRUTH for voice + terms: tenants/metheim/brand-guidelines.md v1.0.
--   · MillionStay/Million Homestay  → Metheim  (brand)
--   · Million Homestay Australia    → Metheim Yeosu
--   · 멜버른 / Melbourne             → 여수(원도심 연등동)
--   · 유학생 / 국제 유학생 / 노마드   → 단기·장기 거주 이용자 · 1~2인 가구
--   · 홈스테이 / 숙소               → 도심형 소형 주거 · 호실
--
-- APPLY TO THE METHEIM DB ONLY (Supabase: metheim / dhdjxweuushugqltjael) —
-- NEVER the primary MillionStay DB:
--   psql "$METHEIM_DATABASE_URL" -f tenants/metheim/content.seed.ko.sql
--
-- Authoritative for these brand keys: ON CONFLICT overwrites, so re-running
-- re-asserts the Metheim copy over any leaked default. ⚠️ Once staff start
-- editing copy in the admin CMS, manage it there — a blind re-run would revert
-- their edits on these specific keys. `source='human'` marks it review-clean.
--
-- ⚠️ NOT INCLUDED — legal copy (homestay.privacy.* / homestay.terms.*). Those
-- are written to Australian law (Privacy Act 1988, Australian Consumer Law,
-- Victoria jurisdiction, ABN). Machine-swapping "멜버른"→"여수" there would
-- produce a legally WRONG document. Metheim's privacy/terms need Korean legal
-- copy (개인정보보호법 등) drafted with the owner — tracked separately.
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
-- ── Navigation ──────────────────────────────────────────────────────────────
('ko', 'nav.links.forStudents', '입주 안내', 'human'),

-- ── Home ────────────────────────────────────────────────────────────────────
('ko', 'home.hero_tagline', 'Metheim Yeosu', 'human'),
('ko', 'home.hero_subtitle', '여수 원도심, 나만의 불빛이 켜지는 프리미엄 소형 주거', 'human'),
('ko', 'home.why.item1_desc', '1~2인 가구와 2030 싱글족이 Metheim의 풀옵션 소형 주거와 정돈된 관리로 여수 원도심에 나만의 공간을 마련합니다.', 'human'),
('ko', 'home.why.item2_title', '1~2인 가구 맞춤 설계', 'human'),
('ko', 'home.why.item2_desc', '원도심 도보권 입지, 단기와 장기를 모두 담는 유연한 계약. 혼자 사는 삶에 꼭 필요한 것만 넣었습니다.', 'human'),
('ko', 'home.listing.title', 'Metheim 여수 호실', 'human'),
('ko', 'home.plans.m3_desc', '오래 머무는 장기 거주 이용자에게 가장 인기 있는 옵션입니다. 월 요금 대비 5% 절약.', 'human'),
('ko', 'home.cta.tagline', '여수 밤바다의 불빛을 담은 도심형 소형 주거, Metheim Yeosu', 'human'),

-- ── Footer ──────────────────────────────────────────────────────────────────
('ko', 'footer.desc', '여수 원도심의 단기·장기 거주 이용자를 위한 안전하고 정돈된 풀옵션 소형 주거입니다.', 'human'),
('ko', 'footer.copyright', '© {{year}} Metheim Yeosu. 모든 권리 보유.', 'human'),
('ko', 'footer.serving', '여수 원도심 연등동, 1~2인 가구를 위한 도심형 소형 주거', 'human'),
('ko', 'footer.for_students', '입주 안내', 'human'),

-- ── Search ──────────────────────────────────────────────────────────────────
('ko', 'search.rooms_in_melbourne', '여수 호실 {{count}}개', 'human'),

-- ── House rules ─────────────────────────────────────────────────────────────
('ko', 'house_rules.link_student', '입주 안내', 'human'),

-- ── Stay plans ──────────────────────────────────────────────────────────────
('ko', 'stay_plan.p1_desc', '단기 체류나 여수 생활을 먼저 경험해 보고 싶은 분께 적합합니다.', 'human'),
('ko', 'stay_plan.p2_desc', '몇 달간 여수에 머무는 직장인이나 프로젝트 근무자에게 이상적입니다.', 'human'),
('ko', 'stay_plan.p3_desc', '오래 거주하며 가장 낮은 주간 요금을 원하는 장기 이용자에게 가장 인기 있는 옵션입니다.', 'human'),

-- ── About ───────────────────────────────────────────────────────────────────
('ko', 'about.intro_p1', 'Metheim은 여수 원도심의 소형 주거를 1~2인 가구에게 답답하지 않고 따뜻한 나만의 공간으로 만들겠다는 단순한 생각에서 시작했습니다. 혼자 사는 삶에서 안전하고 편안하며 합리적인 집을 찾기가 얼마나 까다로운지 잘 압니다. 그래서 저희가 돕습니다.', 'human'),
('ko', 'about.intro_p3', '한 달부터 장기까지 고를 수 있는 거주 플랜, 여수 원도심 연등동의 풀옵션 소형 호실, 그리고 거주 기간 내내 이어지는 관리 지원을 제공합니다. 숨은 비용 없이, 짐만 들고 오시면 됩니다.', 'human'),
('ko', 'about.t1_text', 'Metheim 덕분에 여수로 옮기는 과정이 순조로웠어요. 원도심 도보권의 딱 맞는 호실을 빠르게 찾았고 모든 절차가 간단했습니다. 첫날부터 잘 관리받는 느낌이었어요.', 'human'),
('ko', 'about.t2_text', '혼자 살 집을 구하는 게 걱정이었는데 Metheim이 정말 편했어요. 문의에 빠르게 답해 주었고 호실은 사진 그대로였습니다. 강력 추천합니다!', 'human'),
('ko', 'about.blog_sub', '여수 원도심에서 혼자 사는 삶에 도움이 되는 팁과 가이드, 이야기들.', 'human'),
('ko', 'about.b1_title', '여수 원도심에서 1~2인 가구가 살기 좋은 동네 TOP 5', 'human'),
('ko', 'about.b2_title', '여수 원도심 생활 시작하기: 입주 체크리스트', 'human'),
('ko', 'about.b3_title', '여수를 알뜰하게 즐기기: 무료 & 저렴한 즐길거리', 'human'),

-- ── Residents guide (구 유학생 안내 → 입주/거주 안내) ─────────────────────────
('ko', 'student.hero_tagline', '단기·장기 거주 안내', 'human'),
('ko', 'student.hero_title', '입주 안내', 'human'),
('ko', 'student.breadcrumb', '입주 안내', 'human'),
('ko', 'student.welcome_label', '여수에 오신 것을 환영합니다', 'human'),
('ko', 'student.intro_p1', '새로운 도시에서 맞는 시작은 설레지만 안전하고 합리적인 나만의 공간을 찾는 일이 스트레스여서는 안 됩니다. Metheim은 여수 원도심에서 단기·장기 거주 이용자가 좋은 호실을 찾도록 돕습니다.', 'human'),
('ko', 'student.intro_p2', '원도심의 생활 인프라와 교통, 지역 커뮤니티가 가까워 여러분의 정착을 최대한 순조롭게 도와드립니다.', 'human'),
('ko', 'student.intro_p3', '저희 호실은 여수 원도심 연등동에 있어 시장과 상권, 버스터미널이 도보권이며 안전하고 정돈된 주거 환경을 갖췄습니다.', 'human'),
('ko', 'student.stat2_label', '여수 원도심', 'human'),
('ko', 'student.benefits_title', '혼자 사는 삶에 필요한 모든 것', 'human'),
('ko', 'student.b4_desc', '여수 원도심 도보권의 풀옵션 호실: 연등동을 비롯한 생활 편의 지역.', 'human'),
('ko', 'student.t2_text', '혼자 살 집이 걱정이었는데 Metheim이 모든 걸 간단하게 만들어 줬어요. 문의에 빠르게 답해 주었고 호실은 사진 그대로였습니다.', 'human'),
('ko', 'student.university_placeholder', '예: 근무지 또는 소속 (선택)', 'human'),

-- ── Partners (구 에이전트) ───────────────────────────────────────────────────
('ko', 'agent.intro_p1', '부동산 중개, 기업 제휴 또는 지역 파트너이신가요? Metheim 파트너 네트워크에 참여해 고객을 여수 원도심의 프리미엄 소형 주거와 연결하고 수수료를 받아 보세요.', 'human'),
('ko', 'agent.intro_p2', '저희는 여수에서 1~2인 가구가 집을 구할 때 겪는 어려움을 잘 압니다. 검증된 호실, 빠른 응대, 매끄러운 예약 절차로 원도심 소형 주거의 가장 믿을 수 있는 소개 파트너입니다.', 'human'),
('ko', 'agent.b2_desc', '여수와 인근 지역의 폭넓은 1~2인 가구 수요에 접근하세요.', 'human'),
('ko', 'agent.t2_text', 'Metheim의 강점은 빠르고 분명한 응대입니다. 여수로 옮겨 온 분들이 스트레스 없이 좋은 집을 찾았습니다.', 'human'),
('ko', 'agent.client_students', '거주 이용자', 'human'),

-- ── FAQ ─────────────────────────────────────────────────────────────────────
('ko', 'faq.cat5', '거주 안내', 'human'),
('ko', 'faq.a3', '네, 직접 방문 투어와 영상 투어를 모두 제공합니다. 편한 시간을 예약하려면 연락해 주세요. 멀리서 오시는 분께는 도착 전에 마음 놓고 결정하실 수 있도록 상세한 영상 투어를 드립니다.', 'human'),
('ko', 'faq.q6', '단기·장기 거주 이용자를 위한 서비스가 있나요?', 'human'),
('ko', 'faq.a6', '물론입니다. 단기·장기 거주 이용자가 저희의 핵심 고객입니다. 원도심 도보권 입지와 풀옵션 설계로 여수 생활을 최대한 편안하게 준비했습니다.', 'human'),

-- ── Auth ────────────────────────────────────────────────────────────────────
('ko', 'auth.login_subtitle', '여수 호실을 관리하려면 로그인하세요', 'human'),
('ko', 'auth.register_subtitle', '여수의 호실을 예약하세요', 'human'),

-- ── Homestay sub-site heading ───────────────────────────────────────────────
('ko', 'homestay.home.why_heading', 'Metheim을 선택하는 이유', 'human'),

-- ── property-admin (same instance DB, same translations table) ───────────────
-- Only the SEO/keyword placeholders carry Melbourne/유학생 copy. The
-- `homestayStudent.*` module (학교 정보(호주 내) 등) and the `settings_company
-- .country_au` enum label are student-homestay/country constructs that don't
-- map onto Metheim's residential model — left as-is, not force-rewritten.
('ko', 'blog.keywords_placeholder', '여수 소형 주거, 원도심 원룸, 1인 가구, 거주', 'human'),
('ko', 'website_content.seo_keywords_placeholder', '여수 소형 주거, 원도심 원룸, 1~2인 가구, 도심형 생활주택, 풀옵션', 'human')

ON CONFLICT (lang, key) DO UPDATE
  SET value = EXCLUDED.value, source = 'human', updated_at = now();
