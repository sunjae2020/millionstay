import { useTranslation } from "react-i18next";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsNumbered, HsCTA } from "@/components/homestay/sections";
import { usePageContent, useHomestaySeo } from "@/lib/usePageContent";

// Partners — single-tier page. Absorbs the former Study Tour (#study-tour)
// sub-page as an anchored section.
export default function PartnersWorking() {
  const { t } = useTranslation();
  const pc = usePageContent("homestay-partners");
  useHomestaySeo("homestay-partners", { titleFallback: t("homestay.partners.layout_title") });

  const STUDY_TOUR_INCLUDES = [
    { body: t("homestay.partners.study_tour_includes_0") },
    { body: t("homestay.partners.study_tour_includes_1") },
    { body: t("homestay.partners.study_tour_includes_2") },
    { body: t("homestay.partners.study_tour_includes_3") },
    { body: t("homestay.partners.study_tour_includes_4") },
    { body: t("homestay.partners.study_tour_includes_5") },
  ];

  const WHY = [
    { title: t("homestay.partners.why_0_title"), body: t("homestay.partners.why_0_body") },
    { title: t("homestay.partners.why_1_title"), body: t("homestay.partners.why_1_body") },
    { title: t("homestay.partners.why_2_title"), body: t("homestay.partners.why_2_body") },
    { title: t("homestay.partners.why_3_title"), body: t("homestay.partners.why_3_body") },
    { title: t("homestay.partners.why_4_title"), body: t("homestay.partners.why_4_body") },
    { title: t("homestay.partners.why_5_title"), body: t("homestay.partners.why_5_body") },
  ];

  const HOW = [
    { title: t("homestay.partners.how_0_title"), body: t("homestay.partners.how_0_body") },
    { title: t("homestay.partners.how_1_title"), body: t("homestay.partners.how_1_body") },
    { title: t("homestay.partners.how_2_title"), body: t("homestay.partners.how_2_body") },
    { title: t("homestay.partners.how_3_title"), body: t("homestay.partners.how_3_body") },
    { title: t("homestay.partners.how_4_title"), body: t("homestay.partners.how_4_body") },
    { title: t("homestay.partners.how_5_title"), body: t("homestay.partners.how_5_body") },
  ];

  return (
    <HomestayLayout title={t("homestay.partners.layout_title")}>
      <HsPageHero
        eyebrow={pc("hero_eyebrow", t("homestay.partners.hero_eyebrow"))}
        title={pc("hero_title", t("homestay.partners.hero_title"))}
        lead={
          <p>
            {pc("hero_lead", t("homestay.partners.hero_lead"))}
          </p>
        }
      />
      <HsSection heading={t("homestay.partners.why_heading")}>
        <HsBullets items={WHY} />
      </HsSection>
      <HsSection heading={t("homestay.partners.how_heading")} tint>
        <HsNumbered items={HOW} />
        <div className="mt-8">
          <HsCTA buttons={[
            { label: t("homestay.partners.cta_partner"), href: "/contact" },
            { label: t("homestay.partners.cta_agent_portal"), href: "#", disabled: true },
          ]} />
        </div>
      </HsSection>

      {/* Study Tour (formerly /partners/study-tour) */}
      <HsSection id="study-tour" heading={t("homestay.partners.study_tour_heading")}>
        <p className="text-gray-600">
          {t("homestay.partners.study_tour_intro")}
        </p>
        <h3 className="mt-8 mb-5 text-lg font-semibold">{t("homestay.partners.study_tour_includes_heading")}</h3>
        <HsBullets items={STUDY_TOUR_INCLUDES} />
        <p className="mt-8 text-gray-600">
          {t("homestay.partners.study_tour_how_it_works")}
        </p>
        <div className="mt-6">
          <HsCTA buttons={[{ label: t("homestay.partners.cta_plan_study_tour"), href: "/contact" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}
