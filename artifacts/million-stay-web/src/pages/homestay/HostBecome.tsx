import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCards, HsBullets, HsCTA } from "@/components/homestay/sections";
import { useTranslation } from "react-i18next";
import { usePageContent, useHomestaySeo } from "@/lib/usePageContent";

// Host Family — single-tier page. Absorbs the former Host Family Benefits
// (#benefits) and 10 Useful Tips (#tips) sub-pages as anchored sections.
// "Apply Now" stays a separate page (/hosts/application), reached via CTA.

export default function HostBecome() {
  const { t } = useTranslation();
  const pc = usePageContent("homestay-hosts");
  useHomestaySeo("homestay-hosts", { titleFallback: t("homestay.hosts.page_title") });

  const STEPS = [
    { title: t("homestay.hosts.steps_1_title"), body: t("homestay.hosts.steps_1_body") },
    { title: t("homestay.hosts.steps_2_title"), body: t("homestay.hosts.steps_2_body") },
    { title: t("homestay.hosts.steps_3_title"), body: t("homestay.hosts.steps_3_body") },
    { title: t("homestay.hosts.steps_4_title"), body: t("homestay.hosts.steps_4_body") },
    { title: t("homestay.hosts.steps_5_title"), body: t("homestay.hosts.steps_5_body") },
  ];

  const BENEFITS = [
    { title: t("homestay.hosts.benefits_1_title"), body: t("homestay.hosts.benefits_1_body") },
    { title: t("homestay.hosts.benefits_2_title"), body: t("homestay.hosts.benefits_2_body") },
    { title: t("homestay.hosts.benefits_3_title"), body: t("homestay.hosts.benefits_3_body") },
    { title: t("homestay.hosts.benefits_4_title"), body: t("homestay.hosts.benefits_4_body") },
  ];

  const COMMITMENT = [
    { title: t("homestay.hosts.commitment_1_title"), body: t("homestay.hosts.commitment_1_body") },
    { title: t("homestay.hosts.commitment_2_title"), body: t("homestay.hosts.commitment_2_body") },
    { title: t("homestay.hosts.commitment_3_title"), body: t("homestay.hosts.commitment_3_body") },
    { title: t("homestay.hosts.commitment_4_title"), body: t("homestay.hosts.commitment_4_body") },
    { title: t("homestay.hosts.commitment_5_title"), body: t("homestay.hosts.commitment_5_body") },
    { title: t("homestay.hosts.commitment_6_title"), body: t("homestay.hosts.commitment_6_body") },
  ];

  const TIPS = [
    { title: t("homestay.hosts.tips_1_title"), body: t("homestay.hosts.tips_1_body") },
    { title: t("homestay.hosts.tips_2_title"), body: t("homestay.hosts.tips_2_body") },
    { title: t("homestay.hosts.tips_3_title"), body: t("homestay.hosts.tips_3_body") },
    { title: t("homestay.hosts.tips_4_title"), body: t("homestay.hosts.tips_4_body") },
    { title: t("homestay.hosts.tips_5_title"), body: t("homestay.hosts.tips_5_body") },
    { title: t("homestay.hosts.tips_6_title"), body: t("homestay.hosts.tips_6_body") },
    { title: t("homestay.hosts.tips_7_title"), body: t("homestay.hosts.tips_7_body") },
    { title: t("homestay.hosts.tips_8_title"), body: t("homestay.hosts.tips_8_body") },
    { title: t("homestay.hosts.tips_9_title"), body: t("homestay.hosts.tips_9_body") },
    { title: t("homestay.hosts.tips_10_title"), body: t("homestay.hosts.tips_10_body") },
  ];

  return (
    <HomestayLayout title={t("homestay.hosts.page_title")}>
      <HsPageHero
        eyebrow={pc("hero_eyebrow", t("homestay.hosts.hero_eyebrow"))}
        title={pc("hero_title", t("homestay.hosts.hero_title"))}
        lead={
          <p>
            {pc("hero_lead", t("homestay.hosts.hero_lead"))}
          </p>
        }
      />
      <HsSection heading={t("homestay.hosts.steps_heading")}>
        <HsNumbered items={STEPS} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: t("homestay.hosts.start_application"), href: "/hosts/application" }]} />
        </div>
      </HsSection>

      {/* Host Family Benefits (formerly /hosts/benefits) */}
      <HsSection id="benefits" heading={t("homestay.hosts.benefits_heading")} tint>
        <HsCards items={BENEFITS} />
        <h3 className="mt-10 mb-5 text-lg font-semibold">{t("homestay.hosts.commitment_heading")}</h3>
        <HsBullets items={COMMITMENT} />
      </HsSection>

      {/* 10 Useful Tips (formerly /hosts/tips) */}
      <HsSection id="tips" heading={t("homestay.hosts.tips_heading")}>
        <HsNumbered items={TIPS} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: t("homestay.hosts.start_application"), href: "/hosts/application" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}
