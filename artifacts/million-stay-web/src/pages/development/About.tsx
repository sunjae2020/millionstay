import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, Compass, HeartHandshake } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { BrandMark } from "@/components/brand-mark";
import { usePageContent } from "@/lib/usePageContent";
import { useCmsPage, useCmsSeo } from "@/lib/useCmsPage";
import { BlockRenderer } from "@workspace/cms-blocks/react";
import { useCmsBlockData } from "@/lib/useCmsBlockData";

// 메트하임 소개 (About Metheim) — brand story, logo meaning, image gallery, vision,
// values and headline numbers. Content-only, CMS-editable per-locale via
// usePageContent("dev-about"); every string falls back to i18n.

// Default free stock images (Unsplash CDN) for the brand image gallery.
const DEFAULT_GALLERY = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=800&q=80",
];

export default function DevAbout() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-about");
  const cmsPage = useCmsPage("dev", "about");
  const cmsData = useCmsBlockData(cmsPage?.blocks ?? [], "dev");

  const VALUES = [
    { icon: Building2, title: pc("value_1_title", t("dev.about.value_1_title")), body: pc("value_1_body", t("dev.about.value_1_body")) },
    { icon: Compass, title: pc("value_2_title", t("dev.about.value_2_title")), body: pc("value_2_body", t("dev.about.value_2_body")) },
    { icon: HeartHandshake, title: pc("value_3_title", t("dev.about.value_3_title")), body: pc("value_3_body", t("dev.about.value_3_body")) },
  ];

  const heroImage = pc("hero_image_url", "");
  const logoImage = pc("logo_image", "");
  const GALLERY = [1, 2, 3, 4].map((n) => ({
    image: pc(`gallery_${n}_image`, DEFAULT_GALLERY[n - 1] ?? ""),
    caption: pc(`gallery_${n}_caption`, t(`dev.about.gallery_${n}_caption`)),
  })).filter((g) => g.image);
  const STATS = [1, 2, 3, 4].map((n) => ({
    value: pc(`stat_${n}_value`, t(`dev.about.stat_${n}_value`)),
    label: pc(`stat_${n}_label`, t(`dev.about.stat_${n}_label`)),
  }));

  // Block-mode pilot: once an editor publishes /about as a block page in the
  // CMS, that tree renders instead of the hardcoded sections below. Until then
  // `cmsPage` is null and nothing about this page changes.
  useCmsSeo(cmsPage, t("dev.about.hero_title"));
  if (cmsPage) {
    return (
      <DevLayout title={cmsPage.title ?? t("dev.about.hero_title")}>
        <BlockRenderer blocks={cmsPage.blocks} tokens={cmsPage.tokens} data={cmsData} />
      </DevLayout>
    );
  }

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

      {/* Logo meaning */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20 grid gap-10 lg:grid-cols-2 items-center">
          <div className="flex justify-center">
            <div className="w-56 h-56 md:w-64 md:h-64 rounded-3xl bg-white shadow-lg flex items-center justify-center p-8">
              {logoImage
                ? <img src={logoImage} alt="" className="max-w-full max-h-full object-contain" />
                : <BrandMark variant="mark" className="max-w-full max-h-full object-contain" textClassName="text-4xl md:text-5xl" />}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-widest uppercase text-white/70">{pc("logo_eyebrow", t("dev.about.logo_eyebrow"))}</p>
            <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold tracking-tight">{pc("logo_title", t("dev.about.logo_title"))}</h2>
            <div className="mt-5 space-y-4 text-white/85 leading-relaxed">
              <p>{pc("logo_body_1", t("dev.about.logo_body_1"))}</p>
              <p>{pc("logo_body_2", t("dev.about.logo_body_2"))}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Image gallery */}
      {GALLERY.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold tracking-widest uppercase text-primary">{pc("gallery_eyebrow", t("dev.about.gallery_eyebrow"))}</p>
            <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("gallery_heading", t("dev.about.gallery_heading"))}
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">{pc("gallery_subtitle", t("dev.about.gallery_subtitle"))}</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GALLERY.map((g, idx) => (
              <figure key={idx} className="group relative aspect-[3/4] rounded-2xl overflow-hidden">
                <img src={g.image} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                {g.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm font-medium text-white">
                    {g.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

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

      {/* Numbers band */}
      <section className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="font-display text-3xl md:text-4xl font-extrabold text-primary">{value}</p>
              <p className="mt-1.5 text-sm text-gray-600">{label}</p>
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
