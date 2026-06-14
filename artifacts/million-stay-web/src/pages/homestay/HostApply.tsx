import { useTranslation } from "react-i18next";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero, HsSection, HsNumbered, HsCTA } from "@/components/homestay/sections";

// 3.4 Apply Now — the host application is LIVE; this page funnels to it.
const STEP_KEYS = [
  "step_host_information",
  "step_household_members",
  "step_home_and_room",
  "step_student_preferences",
  "step_your_introduction",
  "step_emergency_contact",
  "step_terms_and_esignature",
];

export default function HostApply() {
  const { t } = useTranslation();
  const steps = STEP_KEYS.map((k) => ({ body: t(`homestay.host_apply.${k}`) }));

  return (
    <HomestayLayout title={t("homestay.host_apply.page_title")}>
      <HsPageHero
        eyebrow={t("homestay.host_apply.eyebrow")}
        title={t("homestay.host_apply.hero_title")}
        lead={
          <p>
            {t("homestay.host_apply.hero_lead")}
          </p>
        }
      />
      <HsSection heading={t("homestay.host_apply.steps_heading")}>
        <HsNumbered items={steps} />
        <p className="mt-6 text-sm text-gray-600">
          <strong>{t("homestay.host_apply.documents_label")}</strong> {t("homestay.host_apply.documents_list")}
        </p>
        <div className="mt-8">
          <HsCTA buttons={[{ label: t("homestay.host_apply.cta_start"), href: "/for-homestay-host" }]} />
        </div>
      </HsSection>
    </HomestayLayout>
  );
}
