import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, KeyRound, LineChart, ShieldCheck, MapPin, Sparkles, Quote, Star, Newspaper } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { Section } from "@/components/development/DevSection";

// Default free stock images for the building-intro + news cards (Unsplash CDN).
const DEFAULT_INTRO_IMAGE =
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80";
const DEFAULT_NEWS_IMAGES = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=800&q=80",
];

// Home — single-building brand identity. Hero is a crossfading background
// slideshow (3–5 slides, each with its own title/subtitle), then the three
// pillars (Buy · Rent · Management). Every string overlays CMS (pc) on i18n (t),
// and each slide's image + title + subtitle is editable per-locale from the
// admin "Website Pages → Building Site → Home".

// Default free stock images (Unsplash CDN) — Yeosu-style coast, compact-apartment
// exterior, move-in-ready interior, resident lifestyle. Swap per-slide in the CMS.
const DEFAULT_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1920&q=80",
];

// Buy / Rent / Management card imagery — swap per card in the CMS.
const DEFAULT_PILLAR_IMAGES = [
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80",
];

const SLIDE_INTERVAL = 6000;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

interface HeroSlide { image: string; title: string; subtitle: string; }

// Self-contained fade/rise-in on mount (no dependency on any animation plugin).
// Re-mounts per slide via a `key`, so the copy re-animates on every change.
function FadeIn({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <div
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 700ms ease-out, transform 700ms ease-out",
      }}
      className="motion-reduce:!transform-none"
    >
      {children}
    </div>
  );
}

function HeroSlider({ slides, eyebrow, ctaBuy, ctaRent }: {
  slides: HeroSlide[]; eyebrow: string; ctaBuy: string; ctaRent: string;
}) {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    if (reduce || slides.length <= 1) return;
    const id = setInterval(() => setI((p) => (p + 1) % slides.length), SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [reduce, slides.length]);

  const active = slides[i] ?? slides[0];

  return (
    // Hero height: 82vh pushed everything below the fold and read as a splash
    // screen. 58/64vh with a hard cap is the range property sites sit in — the
    // headline still dominates, but the next section shows itself.
    <section className="relative flex items-center min-h-[58vh] md:min-h-[64vh] max-h-[700px] overflow-hidden bg-[hsl(var(--brand-navy))] dev-tex-units">
      {/* Crossfading background layers */}
      {slides.map((s, idx) =>
        s.image && !failed[idx] ? (
          <img
            key={idx}
            src={s.image}
            alt=""
            aria-hidden
            onError={() => setFailed((f) => ({ ...f, [idx]: true }))}
            className="absolute inset-0 w-full h-full object-cover motion-reduce:!transform-none"
            style={{
              opacity: idx === i ? 1 : 0,
              transform: reduce ? "none" : idx === i ? "scale(1.07)" : "scale(1)",
              transitionProperty: "opacity, transform",
              transitionDuration: reduce ? "500ms" : `${SLIDE_INTERVAL + 1200}ms`,
              transitionTimingFunction: "ease-out",
            }}
          />
        ) : null,
      )}
      {/* Navy gradient overlay for text legibility */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, hsl(var(--brand-navy)/0.92) 0%, hsl(var(--brand-navy)/0.7) 45%, hsl(var(--brand-navy)/0.4) 100%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-24 w-full">
        <div className="max-w-2xl text-white">
          {eyebrow && (
            <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{eyebrow}</p>
          )}
          {/* Keyed by slide index so the copy re-animates on each change */}
          <FadeIn key={i}>
            <h1 className="mt-4 font-display text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              {active.title}
            </h1>
            {active.subtitle && (
              <p className="mt-6 text-lg md:text-xl text-white/90 leading-relaxed">{active.subtitle}</p>
            )}
          </FadeIn>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/buy" className="px-7 py-3.5 rounded-full font-semibold text-white bg-primary inline-flex items-center gap-2 transition hover:brightness-95">
              {ctaBuy} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/rent" className="px-7 py-3.5 rounded-full font-semibold text-white border border-white/60 bg-white/10 backdrop-blur-sm inline-flex items-center gap-2 transition hover:bg-white/20">
              {ctaRent}
            </Link>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1}`}
              aria-current={idx === i}
              className="h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{ width: idx === i ? "24px" : "8px", backgroundColor: idx === i ? "#fff" : "rgba(255,255,255,0.5)" }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DevHome() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-home");

  // Up to 5 hero slides. A slide shows if it has an image or a title; the first
  // 4 are seeded with default images + localized copy, the 5th is opt-in via CMS.
  const slides: HeroSlide[] = [1, 2, 3, 4, 5]
    .map((n) => ({
      image: pc(`hero_slide_${n}_image`, DEFAULT_HERO_IMAGES[n - 1] ?? ""),
      title: pc(`hero_slide_${n}_title`, t(`dev.home.slide_${n}_title`, { defaultValue: "" })),
      subtitle: pc(`hero_slide_${n}_subtitle`, t(`dev.home.slide_${n}_subtitle`, { defaultValue: "" })),
    }))
    .filter((s) => s.image || s.title);

  // Backward-compatible single-hero fallback if every slide is empty.
  const heroSlides: HeroSlide[] = slides.length
    ? slides
    : [{
        image: pc("hero_image_url", ""),
        title: pc("hero_title", t("dev.home.hero_title")),
        subtitle: pc("hero_subtitle", t("dev.home.hero_subtitle")),
      }];

  // Each pillar leads with a photograph — the section read as three text boxes
  // when the only visual was an icon. Images are CMS-editable per pillar.
  const PILLARS = [
    { icon: Building2, href: "/buy", image: pc("pillar_buy_image", DEFAULT_PILLAR_IMAGES[0]!), title: pc("pillar_buy_title", t("dev.home.pillar_buy_title")), body: pc("pillar_buy_body", t("dev.home.pillar_buy_body")), cta: t("dev.home.pillar_buy_cta") },
    { icon: KeyRound, href: "/rent", image: pc("pillar_rent_image", DEFAULT_PILLAR_IMAGES[1]!), title: pc("pillar_rent_title", t("dev.home.pillar_rent_title")), body: pc("pillar_rent_body", t("dev.home.pillar_rent_body")), cta: t("dev.home.pillar_rent_cta") },
    { icon: LineChart, href: "/management", image: pc("pillar_mgmt_image", DEFAULT_PILLAR_IMAGES[2]!), title: pc("pillar_mgmt_title", t("dev.home.pillar_mgmt_title")), body: pc("pillar_mgmt_body", t("dev.home.pillar_mgmt_body")), cta: t("dev.home.pillar_mgmt_cta") },
  ];

  const WHY = [
    { icon: MapPin, title: pc("why_1_title", t("dev.home.why_1_title")), body: pc("why_1_body", t("dev.home.why_1_body")) },
    { icon: Sparkles, title: pc("why_2_title", t("dev.home.why_2_title")), body: pc("why_2_body", t("dev.home.why_2_body")) },
    { icon: ShieldCheck, title: pc("why_3_title", t("dev.home.why_3_title")), body: pc("why_3_body", t("dev.home.why_3_body")) },
  ];

  // Building intro — image + short pitch + three headline stats.
  const introImage = pc("intro_image", DEFAULT_INTRO_IMAGE);
  const STATS = [1, 2, 3].map((n) => ({
    value: pc(`intro_stat_${n}_value`, t(`dev.home.intro_stat_${n}_value`)),
    label: pc(`intro_stat_${n}_label`, t(`dev.home.intro_stat_${n}_label`)),
  }));

  // Resident reviews — three CMS slots (quote/name/role per locale, optional avatar).
  const REVIEWS = [1, 2, 3].map((n) => ({
    quote: pc(`review_${n}_quote`, t(`dev.home.review_${n}_quote`)),
    name: pc(`review_${n}_name`, t(`dev.home.review_${n}_name`)),
    role: pc(`review_${n}_role`, t(`dev.home.review_${n}_role`)),
    avatar: pc(`review_${n}_avatar`, ""),
  })).filter((r) => r.quote);

  // News — three CMS slots (title/date/summary per locale, optional image + link).
  const NEWS = [1, 2, 3].map((n) => ({
    title: pc(`news_${n}_title`, t(`dev.home.news_${n}_title`)),
    date: pc(`news_${n}_date`, t(`dev.home.news_${n}_date`)),
    summary: pc(`news_${n}_summary`, t(`dev.home.news_${n}_summary`)),
    image: pc(`news_${n}_image`, DEFAULT_NEWS_IMAGES[n - 1] ?? ""),
    link: pc(`news_${n}_link`, ""),
  })).filter((n) => n.title);

  return (
    <DevLayout pageKey="dev-home">
      <HeroSlider
        slides={heroSlides}
        eyebrow={pc("hero_eyebrow", t("dev.home.hero_eyebrow"))}
        ctaBuy={t("dev.home.hero_cta_buy")}
        ctaRent={t("dev.home.hero_cta_rent")}
      />

      {/* Building intro — image + pitch + headline stats */}
      <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="relative">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-lg">
              <img src={introImage} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -right-4 hidden sm:block w-28 h-28 rounded-2xl bg-[hsl(var(--brand-teal))]/90" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-widest uppercase text-primary">{pc("intro_eyebrow", t("dev.home.intro_eyebrow"))}</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("intro_title", t("dev.home.intro_title"))}
            </h2>
            <p className="mt-5 text-gray-600 leading-relaxed">{pc("intro_body", t("dev.home.intro_body"))}</p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {STATS.map(({ value, label }) => (
                <div key={label} className="rounded-2xl bg-[hsl(var(--brand-cream))] dev-tex-wave px-3 py-5 text-center">
                  <p className="font-display text-2xl md:text-3xl font-extrabold text-primary">{value}</p>
                  <p className="mt-1 text-xs text-gray-600 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <Section tone="plain">
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, href, image, title, body, cta }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[#E4E9EA] bg-white transition hover:-translate-y-1 hover:shadow-[0_10px_32px_rgba(0,50,61,0.12)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                <span className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-primary shadow-sm">
                  <Icon className="w-5 h-5" />
                </span>
              </div>
              <div className="flex flex-1 flex-col p-7">
                <h3 className="font-display text-xl font-bold text-[hsl(var(--brand-navy))]">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{body}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                  {cta} <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Why this building */}
      <Section tone="cream" className="border-y border-black/5">
          <h2 className="text-center font-display text-3xl md:text-4xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("why_heading", t("dev.home.why_heading"))}
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {WHY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl bg-white p-7 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-lg text-[hsl(var(--brand-navy))]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </div>
            ))}
          </div>
      </Section>

      {/* Resident reviews */}
      {REVIEWS.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold tracking-widest uppercase text-primary">{pc("reviews_eyebrow", t("dev.home.reviews_eyebrow"))}</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("reviews_heading", t("dev.home.reviews_heading"))}
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">{pc("reviews_subtitle", t("dev.home.reviews_subtitle"))}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {REVIEWS.map((r, idx) => (
              <figure key={idx} className="rounded-2xl border border-gray-200 bg-white p-7 flex flex-col">
                <Quote className="w-8 h-8 text-[hsl(var(--brand-teal))]" aria-hidden />
                <div className="mt-3 flex gap-0.5 text-[hsl(var(--brand-teal))]">
                  {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="w-4 h-4 fill-current" />)}
                </div>
                <blockquote className="mt-4 text-gray-700 leading-relaxed flex-1">“{r.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  {r.avatar
                    ? <img src={r.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    : <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">{r.name.slice(0, 1)}</span>}
                  <span>
                    <span className="block font-semibold text-sm text-[hsl(var(--brand-navy))]">{r.name}</span>
                    <span className="block text-xs text-gray-500">{r.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* News */}
      {NEWS.length > 0 && (
        <Section tone="tint" className="border-y border-black/5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold tracking-widest uppercase text-primary inline-flex items-center gap-2">
                  <Newspaper className="w-4 h-4" /> {pc("news_eyebrow", t("dev.home.news_eyebrow"))}
                </p>
                <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
                  {pc("news_heading", t("dev.home.news_heading"))}
                </h2>
                <p className="mt-3 text-gray-600 leading-relaxed">{pc("news_subtitle", t("dev.home.news_subtitle"))}</p>
              </div>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {NEWS.map((n, idx) => {
                const Card = (
                  <>
                    <div className="aspect-[16/10] overflow-hidden bg-gray-100">
                      {n.image && <img src={n.image} alt="" className="w-full h-full object-cover transition group-hover:scale-105" />}
                    </div>
                    <div className="p-6">
                      <p className="text-xs font-medium text-primary">{n.date}</p>
                      <h3 className="mt-2 font-semibold text-[hsl(var(--brand-navy))] leading-snug line-clamp-2">{n.title}</h3>
                      <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3">{n.summary}</p>
                    </div>
                  </>
                );
                const cls = "group block rounded-2xl bg-white overflow-hidden border border-gray-100 shadow-sm transition hover:shadow-md hover:-translate-y-0.5";
                return n.link
                  ? <a key={idx} href={n.link} target="_blank" rel="noopener noreferrer" className={cls}>{Card}</a>
                  : <div key={idx} className={cls}>{Card}</div>;
              })}
            </div>
        </Section>
      )}

      {/* CTA band */}
      <section className="bg-[hsl(var(--brand-navy))] dev-tex-units">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center text-white">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{pc("cta_title", t("dev.home.cta_title"))}</h2>
          <p className="mt-4 text-white/85 leading-relaxed">{pc("cta_subtitle", t("dev.home.cta_subtitle"))}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/buy" className="px-7 py-3.5 rounded-full font-semibold bg-primary text-white inline-flex items-center gap-2 transition hover:brightness-95">
              {t("dev.home.pillar_buy_cta")} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/management" className="px-7 py-3.5 rounded-full font-semibold border border-white/60 bg-white/10 text-white inline-flex items-center gap-2 transition hover:bg-white/20">
              {t("dev.home.pillar_mgmt_cta")}
            </Link>
          </div>
        </div>
      </section>
    </DevLayout>
  );
}
