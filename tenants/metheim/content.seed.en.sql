-- =============================================================================
-- tenants/metheim/content.seed.en.sql
-- Metheim Yeosu — English marketing content overlay (guest web + admin).
-- Translated from the finalized Korean seed (content.seed.ko.sql). Same 52 keys,
-- same DB-overlay mechanism, same exclusions (legal copy not included).
-- Brand lockups (Metheim / Metheim Yeosu) kept Latin; {{count}}/{{year}}/{{appName}} preserved.
--
-- APPLY TO THE METHEIM DB ONLY (Supabase: metheim / dhdjxweuushugqltjael):
--   psql "" -f tenants/metheim/content.seed.en.sql
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
('en', 'nav.links.forStudents', 'Move-in Info', 'human'),
('en', 'home.hero_tagline', 'Metheim Yeosu', 'human'),
('en', 'home.hero_subtitle', 'Central Yeosu — premium compact living where your own light comes on.', 'human'),
('en', 'home.why.item1_desc', '1–2 person households and singles in their 20s and 30s make central Yeosu their own with Metheim''s fully furnished compact homes and tidy, dependable management.', 'human'),
('en', 'home.why.item2_title', 'Designed for 1–2 person households', 'human'),
('en', 'home.why.item2_desc', 'A walkable central location and flexible terms for both short and long stays. Just what you need to live on your own — nothing you don''t.', 'human'),
('en', 'home.listing.title', 'Metheim Yeosu Rooms', 'human'),
('en', 'home.plans.m3_desc', 'Our most popular option for long-term residents. Save 5% on the monthly rate.', 'human'),
('en', 'home.cta.tagline', 'Metheim Yeosu — compact urban living that catches the lights of Yeosu''s night sea.', 'human'),
('en', 'footer.desc', 'Safe, well-kept, fully furnished compact homes for short- and long-term residents in central Yeosu.', 'human'),
('en', 'footer.copyright', '© {{year}} Metheim Yeosu. All rights reserved.', 'human'),
('en', 'footer.serving', 'Compact urban homes for 1–2 person households in Yeondeung-dong, central Yeosu.', 'human'),
('en', 'footer.for_students', 'Move-in Info', 'human'),
('en', 'search.rooms_in_melbourne', '{{count}} rooms in Yeosu', 'human'),
('en', 'house_rules.link_student', 'Move-in Info', 'human'),
('en', 'stay_plan.p1_desc', 'Great for a short stay or a first taste of life in Yeosu.', 'human'),
('en', 'stay_plan.p2_desc', 'Ideal for professionals or project workers staying in Yeosu for a few months.', 'human'),
('en', 'stay_plan.p3_desc', 'Our most popular option for long-term residents who want the lowest weekly rate.', 'human'),
('en', 'about.intro_p1', 'Metheim started from a simple idea: to make compact living in central Yeosu feel open and warm — a place of your own for 1–2 person households. We know how hard it is to find a home that''s safe, comfortable, and fairly priced when you live alone. So we help.', 'human'),
('en', 'about.intro_p3', 'We offer stay plans from a month to long-term, fully furnished compact rooms in Yeondeung-dong in central Yeosu, and support that lasts your whole stay. No hidden fees — just bring your bags.', 'human'),
('en', 'about.t1_text', 'Metheim made moving to Yeosu so smooth. I quickly found the right room, walkable in central Yeosu, and every step was simple. I felt looked after from day one.', 'human'),
('en', 'about.t2_text', 'I was nervous about finding a place to live alone, but Metheim made it easy. They answered my questions fast and the room looked exactly like the photos. Highly recommend!', 'human'),
('en', 'about.blog_sub', 'Tips, guides, and stories for living solo in central Yeosu.', 'human'),
('en', 'about.b1_title', 'Top 5 neighborhoods for 1–2 person households in central Yeosu', 'human'),
('en', 'about.b2_title', 'Getting started in central Yeosu: your move-in checklist', 'human'),
('en', 'about.b3_title', 'Enjoy Yeosu on a budget: free and cheap things to do', 'human'),
('en', 'student.hero_tagline', 'Short- and long-term stay guide', 'human'),
('en', 'student.hero_title', 'Move-in Info', 'human'),
('en', 'student.breadcrumb', 'Move-in Info', 'human'),
('en', 'student.welcome_label', 'Welcome to Yeosu', 'human'),
('en', 'student.intro_p1', 'A fresh start in a new city is exciting — but finding a safe, affordable place of your own shouldn''t be stressful. Metheim helps short- and long-term residents find a good room in central Yeosu.', 'human'),
('en', 'student.intro_p2', 'With everyday amenities, transit, and the local community close by in central Yeosu, we make settling in as smooth as possible.', 'human'),
('en', 'student.intro_p3', 'Our rooms are in Yeondeung-dong in central Yeosu, within walking distance of the market, shops, and bus terminal, in a safe, well-kept setting.', 'human'),
('en', 'student.stat2_label', 'Central Yeosu', 'human'),
('en', 'student.benefits_title', 'Everything you need to live on your own', 'human'),
('en', 'student.b4_desc', 'Fully furnished rooms within walking distance in central Yeosu, in Yeondeung-dong and other convenient areas.', 'human'),
('en', 'student.t2_text', 'I was worried about living alone, but Metheim made everything simple. They answered my questions fast and the room looked just like the photos.', 'human'),
('en', 'student.university_placeholder', 'e.g. workplace or affiliation (optional)', 'human'),
('en', 'agent.intro_p1', 'A real estate agent, corporate partner, or local partner? Join the Metheim partner network to connect your clients with premium compact living in central Yeosu and earn a commission.', 'human'),
('en', 'agent.intro_p2', 'We know the challenges 1–2 person households face when finding a home in Yeosu. With verified rooms, fast responses, and a smooth booking process, we''re the most reliable referral partner for compact living in central Yeosu.', 'human'),
('en', 'agent.b2_desc', 'Reach broad demand from 1–2 person households in Yeosu and nearby areas.', 'human'),
('en', 'agent.t2_text', 'Metheim''s strength is fast, clear communication. People moving to Yeosu found a good home without the stress.', 'human'),
('en', 'agent.client_students', 'Residents', 'human'),
('en', 'faq.cat5', 'Residency Info', 'human'),
('en', 'faq.a3', 'Yes, we offer both in-person and video tours. Contact us to book a time that works for you. If you''re coming from far away, we''ll give you a detailed video tour so you can decide with confidence before you arrive.', 'human'),
('en', 'faq.q6', 'Do you have services for short- and long-term residents?', 'human'),
('en', 'faq.a6', 'Absolutely. Short- and long-term residents are our core customers. With a walkable central location and fully furnished design, we''ve made living in Yeosu as comfortable as possible.', 'human'),
('en', 'auth.login_subtitle', 'Log in to manage your Yeosu rooms', 'human'),
('en', 'auth.register_subtitle', 'Book your room in Yeosu', 'human'),
('en', 'homestay.home.why_heading', 'Why choose Metheim', 'human'),
('en', 'blog.keywords_placeholder', 'Yeosu compact living, central Yeosu studio, single household, residency', 'human'),
('en', 'website_content.seo_keywords_placeholder', 'Yeosu compact living, central Yeosu studio, 1–2 person households, urban residence, fully furnished', 'human')

ON CONFLICT (lang, key) DO UPDATE
  SET value = EXCLUDED.value, source = 'human', updated_at = now();
