import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, KeyRound, LineChart, ShieldCheck, MapPin, Sparkles } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";

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
    <section className="relative flex items-center min-h-[82vh] overflow-hidden bg-[hsl(var(--brand-navy))]">
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

  const PILLARS = [
    { icon: Building2, href: "/buy", title: pc("pillar_buy_title", t("dev.home.pillar_buy_title")), body: pc("pillar_buy_body", t("dev.home.pillar_buy_body")), cta: t("dev.home.pillar_buy_cta") },
    { icon: KeyRound, href: "/rent", title: pc("pillar_rent_title", t("dev.home.pillar_rent_title")), body: pc("pillar_rent_body", t("dev.home.pillar_rent_body")), cta: t("dev.home.pillar_rent_cta") },
    { icon: LineChart, href: "/management", title: pc("pillar_mgmt_title", t("dev.home.pillar_mgmt_title")), body: pc("pillar_mgmt_body", t("dev.home.pillar_mgmt_body")), cta: t("dev.home.pillar_mgmt_cta") },
  ];

  const WHY = [
    { icon: MapPin, title: pc("why_1_title", t("dev.home.why_1_title")), body: pc("why_1_body", t("dev.home.why_1_body")) },
    { icon: Sparkles, title: pc("why_2_title", t("dev.home.why_2_title")), body: pc("why_2_body", t("dev.home.why_2_body")) },
    { icon: ShieldCheck, title: pc("why_3_title", t("dev.home.why_3_title")), body: pc("why_3_body", t("dev.home.why_3_body")) },
  ];

  return (
    <DevLayout>
      <HeroSlider
        slides={heroSlides}
        eyebrow={pc("hero_eyebrow", t("dev.home.hero_eyebrow"))}
        ctaBuy={t("dev.home.hero_cta_buy")}
        ctaRent={t("dev.home.hero_cta_rent")}
      />

      {/* Three pillars */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, href, title, body, cta }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-gray-200 bg-white p-8 flex flex-col transition hover:-translate-y-1 hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-[hsl(var(--brand-navy))]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 flex-1">{body}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                {cta} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why this building */}
      <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
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
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-[hsl(var(--brand-navy))]">
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
