#!/usr/bin/env node
// Translation script for blog posts and website pages

const AI_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const AI_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const API_BASE = "http://localhost:8080";

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiPut(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT ${path} failed ${res.status}: ${txt.slice(0,200)}`);
  }
  return res.json();
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function callAI(messages, jsonMode = true) {
  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI error ${res.status}: ${err.slice(0,200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

const LANG_INFO = {
  ko: { name: "Korean", style: "Use polite formal Korean (합쇼체). Keep brand names in English." },
  zh: { name: "Simplified Chinese", style: "Use formal Simplified Chinese. Keep brand names in English." },
  ja: { name: "Japanese", style: "Use polite formal Japanese (です/ます体). Keep brand names in English." },
  vi: { name: "Vietnamese", style: "Use formal Vietnamese. Keep brand names in English." },
};

async function translatePageContent(pageKey, enContent, lang) {
  const { name, style } = LANG_INFO[lang];
  const sysMsg = `You are a professional translator for a student accommodation website serving international students in Melbourne, Australia.
${style}
Keep MillionStay brand name in English. Keep Australian suburb/university names in English.
Translate all field values naturally. For richtext/HTML fields, preserve HTML tags but translate text content.
Return ONLY a JSON object with the same keys as the input, all values translated to ${name}.`;

  const userMsg = `Translate this website page content (page: ${pageKey}) to ${name}:
${JSON.stringify(enContent, null, 2)}`;

  const raw = await callAI([
    { role: "system", content: sysMsg },
    { role: "user", content: userMsg },
  ]);
  return JSON.parse(raw);
}

async function translateSEO(seoData, lang) {
  const { name, style } = LANG_INFO[lang];
  const raw = await callAI([
    {
      role: "system",
      content: `Translate SEO metadata to ${name}. ${style} Keep brand names and MillionStay in English. Return JSON with keys: seo_title, seo_description, seo_keywords`,
    },
    { role: "user", content: JSON.stringify(seoData) },
  ]);
  return JSON.parse(raw);
}

async function translateBlogPost(post, lang) {
  const { name, style } = LANG_INFO[lang];
  const sysMsg = `You are a professional translator for student accommodation content targeting international students in Melbourne, Australia.
${style}
Keep all HTML tags intact (h2, h3, p, strong, em, img, etc.).
Keep URLs, email addresses, MillionStay, Melbourne suburb names (Carlton, Hawthorn, etc.), university names (RMIT, Swinburne, etc.), store names in English.
Translate naturally and fluently — not word-for-word.
Return ONLY a JSON object with these exact keys: title, excerpt, content, seo_title, seo_description, seo_keywords`;

  const userMsg = `Translate to ${name}:

TITLE: ${post.title}
EXCERPT: ${post.excerpt}
SEO_TITLE: ${post.seo_title || post.title}
SEO_DESCRIPTION: ${post.seo_description || post.excerpt}
SEO_KEYWORDS: ${post.seo_keywords || "Melbourne accommodation, student housing"}
CONTENT (HTML):
${post.content}`;

  const raw = await callAI([
    { role: "system", content: sysMsg },
    { role: "user", content: userMsg },
  ]);
  return JSON.parse(raw);
}

const PAGE_CONTENT_EN = {
  home: {
    content: {
      hero_title: "WELCOME",
      hero_subtitle: "Your trusted home away from home in Melbourne, Australia",
      hero_cta_primary: "Browse Rooms",
      hero_cta_secondary: "Learn More",
      why_title: "Why Choose Us",
      why_body: `<p>We know that finding safe, comfortable, and affordable accommodation in a new country is one of the biggest challenges you'll face. MillionStay was built to solve exactly that.</p><h3>Testimonials Network</h3><p>Thousands of happy students and nomads have found their perfect Melbourne home through our verified listings and trusted community.</p><h3>Student &amp; Multi-Sport Focus</h3><p>We understand the needs of international students — from university proximity to flexible leases that match your enrollment period.</p><h3>All-Inclusive Comfort</h3><p>Utilities, Wi-Fi, cleaning, and furnishings are all included. Move in with just your luggage — we handle everything else.</p>`,
      feature_1_title: "Testimonials Network",
      feature_1_body: "Thousands of happy students and nomads have found their perfect Melbourne home through our verified listings and trusted community.",
      feature_2_title: "Student & Multi-Sport Focus",
      feature_2_body: "We understand the needs of international students — from university proximity to flexible leases that match your enrollment period.",
      feature_3_title: "All-Inclusive Comfort",
      feature_3_body: "Utilities, Wi-Fi, cleaning, and furnishings are all included. Move in with just your luggage — we handle everything else.",
      stat_rooms: "500+",
      stat_universities: "22+",
      stat_support: "24/7",
      cta_title: "YOUR BEST CHOICE",
      cta_subtitle: "Find your perfect room in Melbourne's top student suburbs. All-inclusive pricing, flexible contracts, multilingual support.",
      cta_button: "Find a Room",
    },
    seo_title: "MillionStay — Student Accommodation Melbourne",
    seo_description: "Safe, affordable, fully furnished student accommodation in Melbourne. Flexible 1–6 month stay plans near top universities.",
    seo_keywords: "student accommodation Melbourne, international student housing, furnished rooms Melbourne, university accommodation",
  },
  "for-student": {
    content: {
      hero_title: "For Students",
      hero_subtitle: "Overseas Student Program",
      intro_title: "YOUR HOME AWAY FROM HOME",
      intro_body: `<p>Arriving in a new country is exciting — but finding a safe, affordable place to live shouldn't be stressful. MillionStay specialises in helping international students find quality accommodation in Melbourne, with a process designed around your needs.</p><p>We work directly with universities, migration agents and student support services across Melbourne to make your transition as smooth as possible. From the moment you enquire to the day you check out, our multilingual team is by your side.</p><p>Our rooms are located near Melbourne's leading universities — University of Melbourne, RMIT, Swinburne, Monash, Deakin and more — in well-connected, safe suburban neighbourhoods.</p>`,
      feature_1_title: "Verified & Safe Rooms",
      feature_1_body: "Every room is personally inspected by our team before listing. No scams, no surprises.",
      feature_2_title: "Multilingual Support",
      feature_2_body: "Our team speaks English, Korean, Chinese, Japanese and Thai. We're here to help in your language.",
      feature_3_title: "Flexible Stay Plans",
      feature_3_body: "Stay from 4 to 24 weeks. No long-term leases, no stress — just flexibility to match your study schedule.",
      feature_4_title: "Bills Included",
      feature_4_body: "High-speed Wi-Fi, electricity, water and gas included in your weekly rate. No surprise utility bills.",
      cta_primary: "Browse Rooms",
      cta_secondary: "Send Enquiry",
      hero_image_url: "",
    },
    seo_title: "Student Accommodation Melbourne — MillionStay",
    seo_description: "Find safe, affordable student rooms near Melbourne's top universities. Flexible 1–6 month plans, all bills included, multilingual support.",
    seo_keywords: "student accommodation Melbourne, rooms for international students, university housing Melbourne, furnished student rooms",
  },
  "for-agent": {
    content: {
      hero_title: "For Agent",
      hero_subtitle: "Partner Program",
      intro_title: "PARTNER WITH MILLIONSTAY",
      intro_body: `<p>Are you a migration agent, education consultant or student recruitment agency? MillionStay invites you to join our growing partner network and earn commissions by connecting your clients with premium Melbourne accommodation.</p><p>We understand the challenges international students face when relocating to Melbourne. Our verified properties, multilingual team and seamless booking process make us the most trusted referral partner for student housing in the city.</p><p>Whether you work with students from Korea, China, Japan, Thailand, India or beyond — MillionStay has the right accommodation and the right support for every client profile.</p>`,
      benefit_1_title: "Competitive Commission",
      benefit_1_body: "Earn industry-leading referral commissions for every successful booking. Paid promptly upon guest check-in.",
      benefit_2_title: "Multilingual Clients",
      benefit_2_body: "Access a wide international student market spanning Korea, China, Japan, Thailand and beyond.",
      benefit_3_title: "Real-time Dashboard",
      benefit_3_body: "Track your referrals, commissions and booking statuses through our dedicated agent portal.",
      how_title: "HOW TO JOIN",
      how_body: `<h3>01 — Apply to Partner</h3><p>Complete our agent registration form. We'll review your application and respond within 2 business days.</p><h3>02 — Get Approved &amp; Onboarded</h3><p>Once approved, you'll receive access to our agent portal, property inventory and co-branded materials.</p><h3>03 — Refer &amp; Earn</h3><p>Refer clients to MillionStay and track every booking. Commissions are paid promptly upon successful check-in.</p>`,
      cta_title: "AGENT REGISTRATION",
      cta_button: "Apply to Partner",
    },
    seo_title: "Agent Partner Program — MillionStay Melbourne",
    seo_description: "Join MillionStay's agent partner network. Earn competitive commissions referring international students to Melbourne's top student accommodation.",
    seo_keywords: "migration agent Melbourne, student accommodation referral, agent partner program, commission accommodation Melbourne",
  },
  about: {
    content: {
      hero_title: "About Us",
      hero_subtitle: "Who we are",
      mission_title: "GET TO KNOW US",
      mission_body: `<p>MillionStay was founded with a simple mission: to make accommodation in Melbourne genuinely accessible and welcoming for international students and digital nomads. We know that finding a safe, comfortable, and affordable home in a new country is one of the biggest challenges you'll face — and we're here to make it easier.</p><p>Our multilingual team (English, Korean, Chinese, Japanese and Thai) works every day to match students with the right rooms, handle paperwork, and ensure every guest feels at home from the moment they arrive.</p><p>We offer flexible stay plans from 1 to 6 months, quality-verified rooms across Melbourne's best student suburbs, and personal support throughout your entire stay. No hidden fees, no stress — just a great place to call home.</p>`,
      values_title: "Our Values",
      value_1_title: "Accessibility",
      value_1_body: "We believe everyone deserves safe, affordable accommodation — regardless of their background or language.",
      value_2_title: "Trust",
      value_2_body: "Every property we list is personally verified by our team. What you see is what you get.",
      value_3_title: "Community",
      value_3_body: "We build lasting relationships with our tenants, supporting them throughout their entire Melbourne journey.",
      team_title: "Our Team",
      team_body: `<p>Our small but dedicated team brings together expertise in property management, student services and international relations.</p><p><strong>Sarah Johnson</strong> — Founder &amp; CEO. Sarah founded MillionStay in 2015 with a vision to transform student accommodation in Melbourne.</p><p><strong>David Kim</strong> — Operations Manager. David oversees our property network and ensures every room meets our strict quality standards.</p><p><strong>Mia Chen</strong> — Student Relations. Mia supports our international students from enquiry to check-out, in English, Chinese and Korean.</p>`,
    },
    seo_title: "About MillionStay — Student Accommodation Melbourne",
    seo_description: "Learn about MillionStay — founded to provide safe, affordable, multilingual student accommodation across Melbourne since 2015.",
    seo_keywords: "about MillionStay, student accommodation company Melbourne, multilingual property management",
  },
  faq: {
    content: {
      hero_title: "Frequently Asked Questions",
      hero_subtitle: "Got questions?",
      section_1_title: "Booking & Rooms",
      section_1_body: `<h3>How do I book a room at MillionStay?</h3><p>You can browse available rooms on our Location page and submit an enquiry or application directly from each listing. Our team will get back to you within 24 hours to confirm availability and guide you through the next steps.</p><h3>What is included in the rent?</h3><p>All our rooms include Wi-Fi, utilities (electricity, water, gas), weekly cleaning of common areas, and access to shared kitchen and laundry facilities.</p><h3>Can I view the room before booking?</h3><p>Yes! We offer both in-person and virtual tours. For international students arriving from overseas, we can organise a detailed video walkthrough.</p><h3>What is the minimum stay period?</h3><p>Our minimum stay is typically 4 weeks (1 month). We offer flexible monthly rolling contracts with no long-term lease commitment.</p>`,
      section_2_title: "Payments & Bond",
      section_2_body: `<h3>Is there a bond or security deposit?</h3><p>Yes, a bond equivalent to 4 weeks' rent is required upon signing. This is held in accordance with Victorian tenancy law and returned at the end of your stay, provided the room is left in good condition.</p><h3>Are bills included in the weekly price?</h3><p>Yes, electricity, water, gas, and high-speed internet are all included in your weekly rent. There are no hidden costs.</p><h3>How do I pay my rent?</h3><p>Rent is payable weekly or fortnightly via bank transfer or credit card. You will receive an invoice through your online portal each billing cycle.</p>`,
      section_3_title: "Student Support",
      section_3_body: `<h3>Do you cater to international students?</h3><p>Absolutely — international students are our core community. We have multilingual staff (Korean, Japanese, Chinese, Thai), and our rooms are designed to make your transition to Melbourne as comfortable as possible.</p><h3>What documents do I need to provide?</h3><p>Typically you will need a copy of your passport, student ID or enrolment letter, and proof of funds. Our team will advise you on exactly what's needed.</p><h3>Can I have guests stay overnight?</h3><p>Overnight guests are allowed with advance notice to management, up to a maximum of 2 consecutive nights. Extended stays must be approved.</p>`,
      cta_title: "Still have questions?",
      cta_body: "Our team is here to help. Get in touch and we'll respond within 24 hours.",
      cta_button: "Contact Us",
    },
    seo_title: "FAQ — MillionStay Student Accommodation Melbourne",
    seo_description: "Answers to common questions about booking, payments, bills, bond, and student support at MillionStay Melbourne.",
    seo_keywords: "MillionStay FAQ, student accommodation questions Melbourne, booking FAQ, rent includes utilities",
  },
  contact: {
    content: {
      hero_title: "Contact Us",
      hero_subtitle: "We'd love to hear from you",
      address_title: "Office Address",
      address: "Level 5, 123 Collins Street\nMelbourne VIC 3000\nAustralia",
      phone_label: "Phone",
      phone: "+61 3 9000 0000",
      email_label: "Email",
      email: "info@millionstay.com",
      hours_label: "Business Hours",
      hours: "Monday – Friday: 9:00 AM – 6:00 PM\nSaturday: 10:00 AM – 4:00 PM\nSunday: Closed",
      form_title: "Send us a message",
      form_subtitle: "Have a question about our rooms, booking process, or stay plans? Our multilingual team is here to help — in English, Korean, Chinese, Japanese or Thai.",
    },
    seo_title: "Contact MillionStay — Melbourne Student Accommodation",
    seo_description: "Get in touch with MillionStay. We respond within 24 hours in English, Korean, Chinese, Japanese and Thai.",
    seo_keywords: "contact MillionStay Melbourne, student accommodation enquiry, multilingual support Melbourne",
  },
};

const LANGS = ["ko", "zh", "ja", "vi"];

async function main() {
  console.log("=== MillionStay Content Translation Script ===\n");

  const { token } = await apiPost("/api/v1/auth/login", {
    email: "admin@millionstay.com",
    password: "MillionStay@2026!",
  });
  console.log("✓ Logged in\n");

  // ── Step 1: Save English page content ───────────────────────────────────────
  console.log("=== STEP 1: English page content ===");
  for (const [pageKey, data] of Object.entries(PAGE_CONTENT_EN)) {
    try {
      const r = await apiPut(`/api/v1/page-contents/${pageKey}/en`, data, token);
      console.log(`  ✓ EN saved: ${pageKey} (id=${r.id})`);
    } catch (e) {
      console.error(`  ✗ EN failed: ${pageKey}: ${e.message}`);
    }
  }

  // ── Step 2: Translate page content ──────────────────────────────────────────
  console.log("\n=== STEP 2: Translating page content ===");
  for (const [pageKey, enData] of Object.entries(PAGE_CONTENT_EN)) {
    console.log(`\n  Page: ${pageKey}`);
    await Promise.all(LANGS.map(async (lang) => {
      try {
        const [translatedContent, translatedSEO] = await Promise.all([
          translatePageContent(pageKey, enData.content, lang),
          translateSEO({
            seo_title: enData.seo_title,
            seo_description: enData.seo_description,
            seo_keywords: enData.seo_keywords,
          }, lang),
        ]);
        await apiPut(`/api/v1/page-contents/${pageKey}/${lang}`, {
          content: translatedContent,
          seo_title: translatedSEO.seo_title,
          seo_description: translatedSEO.seo_description,
          seo_keywords: translatedSEO.seo_keywords,
        }, token);
        console.log(`    ✓ ${lang.toUpperCase()}`);
      } catch (e) {
        console.error(`    ✗ ${lang.toUpperCase()}: ${e.message?.slice(0, 120)}`);
      }
    }));
  }

  // ── Step 3: Translate blog posts ─────────────────────────────────────────────
  console.log("\n=== STEP 3: Translating blog posts ===");
  const { data: posts } = await apiGet("/api/v1/blog-posts?limit=20", token);
  console.log(`  Found ${posts.length} posts\n`);

  for (const post of posts) {
    console.log(`  Blog ID=${post.id}: "${post.title}"`);
    const translations = {};

    await Promise.all(LANGS.map(async (lang) => {
      try {
        translations[lang] = await translateBlogPost(post, lang);
        console.log(`    ✓ ${lang.toUpperCase()}`);
      } catch (e) {
        console.error(`    ✗ ${lang.toUpperCase()}: ${e.message?.slice(0, 120)}`);
      }
    }));

    // PUT blog post with only translations field (UpdateBlogPostBody accepts partial updates)
    const putRes = await apiPut(`/api/v1/blog-posts/${post.id}`, { translations }, token);
    if (putRes && putRes.id) {
      console.log(`    ✓ Saved translations for post ${post.id}`);
    } else {
      console.error(`    ✗ Save returned: ${JSON.stringify(putRes).slice(0, 100)}`);
    }
  }

  console.log("\n=== Done! ===");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
