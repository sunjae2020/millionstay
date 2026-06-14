import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsBullets, HsCards, HsNumbered, HsCTA } from "@/components/homestay/sections";
import { useTranslation } from "react-i18next";
import { usePageContent, useHomestaySeo } from "@/lib/usePageContent";

// Student — single-tier page. Absorbs the former Advantages (#advantages),
// 10 Useful Tips (#tips) and Essential Information (#essentials) sub-pages as
// anchored sections. "Apply Now" stays a separate page, reached via CTA.

export default function StudentBecome() {
  const { t } = useTranslation();
  const pc = usePageContent("homestay-students");
  useHomestaySeo("homestay-students", { titleFallback: t("homestay.students.page_title") });

  const APPLYING = [
    { body: t("homestay.students.applying_1_body") },
    { body: t("homestay.students.applying_2_body") },
    { body: t("homestay.students.applying_3_body") },
    { body: t("homestay.students.applying_4_body") },
    { body: t("homestay.students.applying_5_body") },
  ];

  const ADVANTAGES = [
    { title: t("homestay.students.advantages_1_title"), body: t("homestay.students.advantages_1_body") },
    { title: t("homestay.students.advantages_2_title"), body: t("homestay.students.advantages_2_body") },
    { title: t("homestay.students.advantages_3_title"), body: t("homestay.students.advantages_3_body") },
    { title: t("homestay.students.advantages_4_title"), body: t("homestay.students.advantages_4_body") },
    { title: t("homestay.students.advantages_5_title"), body: t("homestay.students.advantages_5_body") },
    { title: t("homestay.students.advantages_6_title"), body: t("homestay.students.advantages_6_body") },
  ];

  const TIPS = [
    { title: t("homestay.students.tips_1_title"), body: t("homestay.students.tips_1_body") },
    { title: t("homestay.students.tips_2_title"), body: t("homestay.students.tips_2_body") },
    { title: t("homestay.students.tips_3_title"), body: t("homestay.students.tips_3_body") },
    { title: t("homestay.students.tips_4_title"), body: t("homestay.students.tips_4_body") },
    { title: t("homestay.students.tips_5_title"), body: t("homestay.students.tips_5_body") },
    { title: t("homestay.students.tips_6_title"), body: t("homestay.students.tips_6_body") },
    { title: t("homestay.students.tips_7_title"), body: t("homestay.students.tips_7_body") },
    { title: t("homestay.students.tips_8_title"), body: t("homestay.students.tips_8_body") },
    { title: t("homestay.students.tips_9_title"), body: t("homestay.students.tips_9_body") },
    { title: t("homestay.students.tips_10_title"), body: t("homestay.students.tips_10_body") },
  ];

  const INFO = [
    { title: t("homestay.students.info_1_title"), body: t("homestay.students.info_1_body") },
    { title: t("homestay.students.info_2_title"), body: t("homestay.students.info_2_body") },
    { title: t("homestay.students.info_3_title"), body: t("homestay.students.info_3_body") },
    { title: t("homestay.students.info_4_title"), body: t("homestay.students.info_4_body") },
    { title: t("homestay.students.info_5_title"), body: t("homestay.students.info_5_body") },
    { title: t("homestay.students.info_6_title"), body: t("homestay.students.info_6_body") },
    { title: t("homestay.students.info_7_title"), body: t("homestay.students.info_7_body") },
    { title: t("homestay.students.info_8_title"), body: t("homestay.students.info_8_body") },
    { title: t("homestay.students.info_9_title"), body: t("homestay.students.info_9_body") },
    { title: t("homestay.students.info_10_title"), body: t("homestay.students.info_10_body") },
  ];

  return (
    <HomestayLayout title={t("homestay.students.page_title")}>
      <HsPageHero
        eyebrow={pc("hero_eyebrow", t("homestay.students.hero_eyebrow"))}
        title={pc("hero_title", t("homestay.students.hero_title"))}
        lead={
          <p>
            {pc("hero_lead", t("homestay.students.hero_lead"))}
          </p>
        }
      />
      <HsSection heading={t("homestay.students.applying_heading")}>
        <HsBullets items={APPLYING} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: t("homestay.students.apply_now"), href: "/students/apply" }]} />
        </div>
      </HsSection>
      <HsSection tint>
        <p className="text-gray-600">
          {t("homestay.students.matching_note")}
        </p>
      </HsSection>

      {/* Advantages (formerly /students/advantages) */}
      <HsSection id="advantages" heading={t("homestay.students.advantages_heading")}>
        <HsCards items={ADVANTAGES} />
      </HsSection>

      {/* 10 Useful Tips (formerly /students/tips) */}
      <HsSection id="tips" heading={t("homestay.students.tips_heading")} tint>
        <HsNumbered items={TIPS} />
      </HsSection>

      {/* Essential Information (formerly /students/essential-information) */}
      <HsSection id="essentials" heading={t("homestay.students.essentials_heading")}>
        <HsBullets items={INFO} />
        <div className="mt-8">
          <HsCTA buttons={[{ label: t("homestay.students.apply_now"), href: "/students/apply" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}
