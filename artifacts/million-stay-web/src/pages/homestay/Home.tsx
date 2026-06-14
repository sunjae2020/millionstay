import { Link } from "wouter";
import { ArrowRight, Users, Baby, ShieldCheck, Globe2, BadgeCheck, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import hero from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// 0. MAIN HOME — content from the Million Homestay site-content doc (page 0).
// CTAs to not-yet-built features (student apply, partners, full process) route
// to their pages, which render the "coming soon" stub until that phase ships.

export default function HomestayHome() {
  const { t } = useTranslation();

  const WHY = [
    { icon: Users, title: t("homestay.home.why_1_title"), body: t("homestay.home.why_1_body") },
    { icon: Baby, title: t("homestay.home.why_2_title"), body: t("homestay.home.why_2_body") },
    { icon: ShieldCheck, title: t("homestay.home.why_3_title"), body: t("homestay.home.why_3_body") },
    { icon: Globe2, title: t("homestay.home.why_4_title"), body: t("homestay.home.why_4_body") },
    { icon: BadgeCheck, title: t("homestay.home.why_5_title"), body: t("homestay.home.why_5_body") },
    { icon: Headphones, title: t("homestay.home.why_6_title"), body: t("homestay.home.why_6_body") },
  ];

  const EXPLORE = [
    { title: t("homestay.home.explore_1_title"), body: t("homestay.home.explore_1_body"), cta: t("homestay.home.explore_1_cta"), href: "/students/apply" },
    { title: t("homestay.home.explore_2_title"), body: t("homestay.home.explore_2_body"), cta: t("homestay.home.explore_2_cta"), href: "/for-homestay-host" },
    { title: t("homestay.home.explore_3_title"), body: t("homestay.home.explore_3_body"), cta: t("homestay.home.explore_3_cta"), href: "/partners" },
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
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0">
          <img src={hero} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(63,45,49,0.78) 0%, rgba(63,45,49,0.45) 60%, rgba(63,45,49,0.25) 100%)" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-5 py-24 md:py-32">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight" style={{ fontFamily: HS_FONT.head }}>
              {t("homestay.home.hero_title")}
            </h1>
            <p className="mt-5 text-lg text-white/90">
              {t("homestay.home.hero_lead")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/students/apply" className="px-6 py-3 rounded-lg font-semibold text-white inline-flex items-center gap-2" style={{ backgroundColor: HS.brand }}>
                {t("homestay.home.hero_cta_find")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/for-homestay-host" className="px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 bg-white text-gray-900">
                {t("homestay.home.hero_cta_host")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Million Homestay */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <h2 className="text-3xl font-bold text-center" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{t("homestay.home.why_heading")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl p-6" style={{ backgroundColor: HS.cream }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "white", color: HS.brand }}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore */}
      <section style={{ backgroundColor: "#f6efec" }} className="border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-5 py-16 grid gap-6 md:grid-cols-3">
          {EXPLORE.map((c) => (
            <div key={c.title} className="bg-white rounded-2xl border border-gray-100 p-7 flex flex-col">
              <h3 className="text-lg font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{c.title}</h3>
              <p className="mt-2 text-sm text-gray-600 flex-1">{c.body}</p>
              <Link href={c.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: HS.brand }}>
                {c.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works at a glance */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20 text-center">
        <h2 className="text-3xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>{t("homestay.home.how_heading")}</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <span className="px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: HS.cream, color: HS.darkBrown }}>{s}</span>
              {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>
        <p className="mt-6 text-gray-600 max-w-2xl mx-auto">
          {t("homestay.home.how_body")}
        </p>
        <Link href="/how-it-works" className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white" style={{ backgroundColor: HS.brand }}>
          {t("homestay.home.how_cta")} <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </HomestayLayout>
  );
}
