import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCTA } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";
import { useTranslation } from "react-i18next";
import { usePageContent, useHomestaySeo } from "@/lib/usePageContent";

// About Us — single-tier page. Absorbs the former How It Works (#how-it-works),
// Mission (#mission) and Vision (#vision) sub-pages as anchored sections.

export default function AboutUs() {
  const { t } = useTranslation();
  const pc = usePageContent("homestay-about");
  useHomestaySeo("homestay-about", { titleFallback: t("homestay.about.page_title") });

  const STUDENT_STEPS = [
    { title: t("homestay.about.student_steps_1_title"), body: t("homestay.about.student_steps_1_body") },
    { title: t("homestay.about.student_steps_2_title"), body: t("homestay.about.student_steps_2_body") },
    { title: t("homestay.about.student_steps_3_title"), body: t("homestay.about.student_steps_3_body") },
    { title: t("homestay.about.student_steps_4_title"), body: t("homestay.about.student_steps_4_body") },
    { title: t("homestay.about.student_steps_5_title"), body: t("homestay.about.student_steps_5_body") },
  ];

  const HOST_STEPS = [
    { title: t("homestay.about.host_steps_1_title"), body: t("homestay.about.host_steps_1_body") },
    { title: t("homestay.about.host_steps_2_title"), body: t("homestay.about.host_steps_2_body") },
    { title: t("homestay.about.host_steps_3_title"), body: t("homestay.about.host_steps_3_body") },
    { title: t("homestay.about.host_steps_4_title"), body: t("homestay.about.host_steps_4_body") },
    { title: t("homestay.about.host_steps_5_title"), body: t("homestay.about.host_steps_5_body") },
  ];

  return (
    <HomestayLayout title={t("homestay.about.page_title")}>
      <HsPageHero
        eyebrow={pc("hero_eyebrow", t("homestay.about.hero_eyebrow"))}
        title={pc("hero_title", t("homestay.about.hero_title"))}
        lead={
          <>
            <p>{pc("hero_lead_p1", t("homestay.about.hero_lead_p1"))}</p>
            <p>{pc("hero_lead_p2", t("homestay.about.hero_lead_p2"))}</p>
          </>
        }
      />
      <HsSection heading={pc("bridging_heading", t("homestay.about.bridging_heading"))}>
        <p className="text-gray-600">
          {pc("bridging_body", t("homestay.about.bridging_body"))}
        </p>
      </HsSection>
      <HsSection heading={t("homestay.about.tailored_heading")} tint>
        <p className="text-gray-600">
          {t("homestay.about.tailored_body")}
        </p>
        <div className="mt-8">
          <HsCTA buttons={[
            { label: t("homestay.about.cta_apply_now"), href: "/students/apply" },
            { label: t("homestay.about.cta_become_host"), href: "/hosts/application", variant: "outline" },
          ]} />
        </div>
      </HsSection>

      {/* How It Works (formerly /how-it-works) */}
      <HsSection id="how-it-works" heading={t("homestay.about.how_it_works_heading")}>
        <p className="text-gray-600">
          {t("homestay.about.how_it_works_body")}
        </p>
        <h3 className="mt-8 mb-4 text-lg font-semibold" style={{ color: HS.darkBrown }}>{t("homestay.about.how_it_works_for_students")}</h3>
        <HsNumbered items={STUDENT_STEPS} />
        <h3 className="mt-10 mb-4 text-lg font-semibold" style={{ color: HS.darkBrown }}>{t("homestay.about.how_it_works_for_host_families")}</h3>
        <HsNumbered items={HOST_STEPS} />
        <div className="mt-10 rounded-2xl p-6" style={{ backgroundColor: HS.apricot }}>
          <h3 className="font-semibold" style={{ color: HS.navy }}>{t("homestay.about.fees_heading")}</h3>
          <p className="mt-2" style={{ color: HS.inkMuted }}>
            {t("homestay.about.fees_body")}
          </p>
          <p className="mt-3 text-sm italic" style={{ color: HS.inkMuted }}>
            {t("homestay.about.fees_note")}
          </p>
          <p className="mt-4 text-sm font-medium" style={{ color: HS.navy }}>
            {t("homestay.about.fees_disclaimer")}
          </p>
        </div>
      </HsSection>

      {/* Mission (formerly /mission) */}
      <HsSection id="mission" heading={pc("mission_heading", t("homestay.about.mission_heading"))} tint>
        <p className="text-gray-600">
          {pc("mission_body", t("homestay.about.mission_body"))}
        </p>
      </HsSection>

      {/* Vision (formerly /vision) */}
      <HsSection id="vision" heading={pc("vision_heading", t("homestay.about.vision_heading"))}>
        <p className="text-gray-600">
          {pc("vision_body", t("homestay.about.vision_body"))}
        </p>
      </HsSection>
    </HomestayLayout>
  );
}
