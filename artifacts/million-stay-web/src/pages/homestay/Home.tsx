import { Link } from "wouter";
import { ArrowRight, Users, Baby, ShieldCheck, Globe2, BadgeCheck, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import hero from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT, HS_RADIUS, HS_SHADOW } from "@/lib/homestay-theme";
import { usePageContent, useHomestaySeo } from "@/lib/usePageContent";

// 0. MAIN HOME — Brand Guideline v2.0 redesign (Hero Variant A: navy gradient).
// Colour roles: Orange = action (CTAs/links/most icons), Navy = structure
// (headings/footer), Teal = trust signature in fixed slots only (safety/support
// cards, the partners audience tab, the how-it-works step connectors). Copy is
// unchanged — every string still comes from pc()/t().

export default function HomestayHome() {
  const { t } = useTranslation();
  const pc = usePageContent("homestay-home");
  useHomestaySeo("homestay-home");

  // `teal: true` marks the two trust cards (Safety, Support) — the only teal
  // accents in this grid, per the fixed-slot rule.
  const WHY = [
    { icon: Users, title: t("homestay.home.why_1_title"), body: t("homestay.home.why_1_body") },
    { icon: Baby, title: t("homestay.home.why_2_title"), body: t("homestay.home.why_2_body") },
    { icon: ShieldCheck, title: t("homestay.home.why_3_title"), body: t("homestay.home.why_3_body"), teal: true },
    { icon: Globe2, title: t("homestay.home.why_4_title"), body: t("homestay.home.why_4_body") },
    { icon: BadgeCheck, title: t("homestay.home.why_5_title"), body: t("homestay.home.why_5_body") },
    { icon: Headphones, title: t("homestay.home.why_6_title"), body: t("homestay.home.why_6_body"), teal: true },
  ];

  // Audience tabs: students=orange, host=navy, partners=teal (satisfies the 3%
  // teal rule with a single fixed slot).
  const EXPLORE = [
    { title: t("homestay.home.explore_1_title"), body: t("homestay.home.explore_1_body"), cta: t("homestay.home.explore_1_cta"), href: "/students/apply", tab: HS.orange },
    { title: t("homestay.home.explore_2_title"), body: t("homestay.home.explore_2_body"), cta: t("homestay.home.explore_2_cta"), href: "/for-homestay-host", tab: HS.navy },
    { title: t("homestay.home.explore_3_title"), body: t("homestay.home.explore_3_body"), cta: t("homestay.home.explore_3_cta"), href: "/partners", tab: HS.teal },
  ];

  const STEPS = [
    t("homestay.home.step_1"),
    t("homestay.home.step_2"),
    t("homestay.home.step_3"),
    t("homestay.home.step_4"),
    t("homestay.home.step_5"),
  ];

  return (
    <HomestayLayout>
      {/* Hero — Variant A: photo + left→right navy gradient overlay */}
      <section className="relative flex items-center min-h-[88vh]">
        <div className="absolute inset-0">
          <img src={hero} alt="" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(22,38,63,0.88) 0%, rgba(22,38,63,0.62) 45%, rgba(22,38,63,0.30) 100%)" }}
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-24 w-full">
          <div className="max-w-2xl text-white">
            <h1
              className="text-4xl md:text-[3.4rem] font-extrabold leading-[1.06]"
              style={{ fontFamily: HS_FONT.display, letterSpacing: "-0.02em" }}
            >
              {pc("hero_title", t("homestay.home.hero_title"))}
            </h1>
            <p className="mt-5 text-lg md:text-xl text-white/90 leading-relaxed">
              {pc("hero_lead", t("homestay.home.hero_lead"))}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/students/apply"
                className="px-7 py-3.5 font-semibold text-white inline-flex items-center gap-2 transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                style={{ backgroundColor: HS.orange, borderRadius: HS_RADIUS.pill }}
              >
                {pc("hero_cta_find", t("homestay.home.hero_cta_find"))} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/for-homestay-host"
                className="px-7 py-3.5 font-semibold inline-flex items-center gap-2 text-white border border-white/70 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
                style={{ borderRadius: HS_RADIUS.pill }}
              >
                {pc("hero_cta_host", t("homestay.home.hero_cta_host"))}
              </Link>
            </div>
          </div>
        </div>
        {/* teal signature — a single small trust accent, bottom-right */}
        <span aria-hidden className="absolute bottom-6 right-6 hidden md:flex items-center gap-2">
          <span className="h-px w-10" style={{ backgroundColor: HS.teal }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: HS.teal }} />
        </span>
      </section>

      {/* Why Million Homestay */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center" style={{ fontFamily: HS_FONT.display, color: HS.navy, letterSpacing: "-0.02em" }}>
          {pc("why_heading", t("homestay.home.why_heading"))}
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body, teal }) => (
            <div
              key={title}
              className="p-6 transition-transform duration-200 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
              style={{ backgroundColor: HS.apricot, borderRadius: HS_RADIUS.lg }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: HS.white, color: teal ? HS.teal : HS.orange }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg" style={{ fontFamily: HS_FONT.display, color: HS.navy }}>{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: HS.inkMuted }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore — audience split with coloured top tabs */}
      <section style={{ backgroundColor: HS.cream, borderTop: `1px solid ${HS.line}`, borderBottom: `1px solid ${HS.line}` }}>
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid gap-6 md:grid-cols-3">
          {EXPLORE.map((c) => (
            <div
              key={c.title}
              className="group bg-white flex flex-col overflow-hidden transition-shadow"
              style={{ borderRadius: HS_RADIUS.lg, boxShadow: HS_SHADOW.card }}
            >
              <span className="h-1.5 w-full" style={{ backgroundColor: c.tab }} />
              <div className="p-7 flex flex-col flex-1">
                <h3 className="text-lg font-bold" style={{ fontFamily: HS_FONT.display, color: HS.navy }}>{c.title}</h3>
                <p className="mt-2 text-sm flex-1 leading-relaxed" style={{ color: HS.inkMuted }}>{c.body}</p>
                <Link
                  href={c.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold transition-transform group-hover:gap-3"
                  style={{ color: HS.orange }}
                >
                  {c.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works at a glance — orange nodes joined by teal connectors */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: HS_FONT.display, color: HS.navy, letterSpacing: "-0.02em" }}>
          {pc("how_heading", t("homestay.home.how_heading"))}
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-y-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <span
                className="px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: HS.orange, borderRadius: HS_RADIUS.pill }}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="mx-2 w-8 border-t-2 border-dashed hidden sm:block"
                  style={{ borderColor: HS.teal }}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-2xl mx-auto leading-relaxed" style={{ color: HS.inkMuted }}>
          {pc("how_body", t("homestay.home.how_body"))}
        </p>
        <Link
          href="/how-it-works"
          className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 font-semibold text-white transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          style={{ backgroundColor: HS.orange, borderRadius: HS_RADIUS.pill }}
        >
          {pc("how_cta", t("homestay.home.how_cta"))} <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </HomestayLayout>
  );
}
