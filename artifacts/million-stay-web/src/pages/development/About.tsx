import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, Compass, HeartHandshake } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";

// 메트하임 소개 (About MetHeim) — brand story, vision and values. Content-only,
// CMS-editable per-locale via usePageContent("dev-about"); falls back to i18n.

export default function DevAbout() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-about");

  const VALUES = [
    { icon: Building2, title: pc("value_1_title", t("dev.about.value_1_title")), body: pc("value_1_body", t("dev.about.value_1_body")) },
    { icon: Compass, title: pc("value_2_title", t("dev.about.value_2_title")), body: pc("value_2_body", t("dev.about.value_2_body")) },
    { icon: HeartHandshake, title: pc("value_3_title", t("dev.about.value_3_title")), body: pc("value_3_body", t("dev.about.value_3_body")) },
  ];

  const heroImage = pc("hero_image_url", "");

  return (
    <DevLayout title={t("dev.about.hero_title")}>
      {/* Hero */}
      <section className="relative bg-[hsl(var(--brand-navy))] text-white">
        {heroImage && <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{pc("eyebrow", t("dev.about.eyebrow"))}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.about.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.about.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("story_title", t("dev.about.story_title"))}
        </h2>
        <div className="mt-5 space-y-4 text-gray-600 leading-relaxed">
          <p>{pc("story_p1", t("dev.about.story_p1"))}</p>
          <p>{pc("story_p2", t("dev.about.story_p2"))}</p>
        </div>
      </section>

      {/* Vision */}
      <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-20 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("vision_title", t("dev.about.vision_title"))}
          </h2>
          <p className="mt-5 text-lg text-gray-700 leading-relaxed">{pc("vision_body", t("dev.about.vision_body"))}</p>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-gray-200 p-7">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg text-[hsl(var(--brand-navy))]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[hsl(var(--brand-navy))]">
        <div className="max-w-4xl mx-auto px-6 py-14 md:py-16 text-center text-white">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{pc("cta_title", t("dev.about.cta_title"))}</h2>
          <p className="mt-3 text-white/85">{pc("cta_subtitle", t("dev.about.cta_subtitle"))}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/buy" className="px-7 py-3.5 rounded-full font-semibold bg-primary text-white inline-flex items-center gap-2 transition hover:brightness-95">
              {t("dev.home.pillar_buy_cta")} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/directions" className="px-7 py-3.5 rounded-full font-semibold border border-white/60 bg-white/10 text-white inline-flex items-center gap-2 transition hover:bg-white/20">
              {t("dev.nav.directions")}
            </Link>
          </div>
        </div>
      </section>
    </DevLayout>
  );
}
