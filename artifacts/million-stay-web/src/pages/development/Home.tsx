import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, KeyRound, LineChart, ShieldCheck, MapPin, Sparkles } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";

// Home — single-building brand identity: exterior / vision, then the three
// pillars (Buy · Rent · Management). Copy overlays CMS (pc) on i18n (t), so the
// MetHeim team can edit every string per-locale from the admin "Website Pages".

export default function DevHome() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-home");

  const PILLARS = [
    {
      icon: Building2, href: "/buy",
      title: pc("pillar_buy_title", t("dev.home.pillar_buy_title")),
      body: pc("pillar_buy_body", t("dev.home.pillar_buy_body")),
      cta: t("dev.home.pillar_buy_cta"),
    },
    {
      icon: KeyRound, href: "/rent",
      title: pc("pillar_rent_title", t("dev.home.pillar_rent_title")),
      body: pc("pillar_rent_body", t("dev.home.pillar_rent_body")),
      cta: t("dev.home.pillar_rent_cta"),
    },
    {
      icon: LineChart, href: "/management",
      title: pc("pillar_mgmt_title", t("dev.home.pillar_mgmt_title")),
      body: pc("pillar_mgmt_body", t("dev.home.pillar_mgmt_body")),
      cta: t("dev.home.pillar_mgmt_cta"),
    },
  ];

  const WHY = [
    { icon: MapPin, title: pc("why_1_title", t("dev.home.why_1_title")), body: pc("why_1_body", t("dev.home.why_1_body")) },
    { icon: Sparkles, title: pc("why_2_title", t("dev.home.why_2_title")), body: pc("why_2_body", t("dev.home.why_2_body")) },
    { icon: ShieldCheck, title: pc("why_3_title", t("dev.home.why_3_title")), body: pc("why_3_body", t("dev.home.why_3_body")) },
  ];

  const heroImage = pc("hero_image_url", "");

  return (
    <DevLayout>
      {/* Hero — building exterior + vision */}
      <section className="relative flex items-center min-h-[82vh]">
        <div className="absolute inset-0 bg-[hsl(var(--brand-navy))]">
          {heroImage && <img src={heroImage} alt="" className="w-full h-full object-cover opacity-70" />}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, hsl(var(--brand-navy)/0.92) 0%, hsl(var(--brand-navy)/0.7) 45%, hsl(var(--brand-navy)/0.4) 100%)" }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="max-w-2xl text-white">
            <p className="text-sm font-semibold tracking-widest uppercase text-white/80">
              {pc("hero_eyebrow", t("dev.home.hero_eyebrow"))}
            </p>
            <h1 className="mt-4 font-display text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              {pc("hero_title", t("dev.home.hero_title"))}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/90 leading-relaxed">
              {pc("hero_subtitle", t("dev.home.hero_subtitle"))}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/buy" className="px-7 py-3.5 rounded-full font-semibold text-white bg-primary inline-flex items-center gap-2 transition hover:brightness-95">
                {t("dev.home.hero_cta_buy")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/rent" className="px-7 py-3.5 rounded-full font-semibold text-white border border-white/60 bg-white/10 backdrop-blur-sm inline-flex items-center gap-2 transition hover:bg-white/20">
                {t("dev.home.hero_cta_rent")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, href, title, body, cta }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-gray-200 bg-white p-8 flex flex-col transition hover:-translate-y-1 hover:shadow-lg"
            >
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
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            {pc("cta_title", t("dev.home.cta_title"))}
          </h2>
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
