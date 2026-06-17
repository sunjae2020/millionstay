import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";

// Privacy Policy for homestay.millionstay.com — Australian Privacy Principles
// (APPs) tailored to the review-and-match homestay service (host vetting,
// child safety, student matching). Reviewed alongside the main-site policy;
// have legal counsel confirm before relying on it commercially.
const EFFECTIVE_DATE = "12 June 2026";

type Clause = { n: string; title: ReactNode; body: ReactNode };

export default function HomestayPrivacy() {
  const { t } = useTranslation();

  const CLAUSES: Clause[] = [
    {
      n: "01",
      title: t("homestay.privacy.clause_1_title"),
      body: t("homestay.privacy.clause_1_body"),
    },
    {
      n: "02",
      title: t("homestay.privacy.clause_2_title"),
      body: t("homestay.privacy.clause_2_body"),
    },
    {
      n: "03",
      title: t("homestay.privacy.clause_3_title"),
      body: t("homestay.privacy.clause_3_body"),
    },
    {
      n: "04",
      title: t("homestay.privacy.clause_4_title"),
      body: t("homestay.privacy.clause_4_body"),
    },
    {
      n: "05",
      title: t("homestay.privacy.clause_5_title"),
      body: t("homestay.privacy.clause_5_body"),
    },
    {
      n: "06",
      title: t("homestay.privacy.clause_6_title"),
      body: t("homestay.privacy.clause_6_body"),
    },
    {
      n: "07",
      title: t("homestay.privacy.clause_7_title"),
      body: t("homestay.privacy.clause_7_body"),
    },
    {
      n: "08",
      title: t("homestay.privacy.clause_8_title"),
      body: t("homestay.privacy.clause_8_body"),
    },
    {
      n: "09",
      title: t("homestay.privacy.clause_9_title"),
      body: t("homestay.privacy.clause_9_body"),
    },
    {
      n: "10",
      title: t("homestay.privacy.clause_10_title"),
      body: t("homestay.privacy.clause_10_body"),
    },
    {
      n: "11",
      title: t("homestay.privacy.clause_11_title"),
      body: t("homestay.privacy.clause_11_body"),
    },
    {
      n: "12",
      title: t("homestay.privacy.clause_12_title"),
      body: t("homestay.privacy.clause_12_body"),
    },
    {
      n: "13",
      title: t("homestay.privacy.clause_13_title"),
      body: t("homestay.privacy.clause_13_body"),
    },
    {
      n: "14",
      title: t("homestay.privacy.clause_14_title"),
      body: t("homestay.privacy.clause_14_body"),
    },
    {
      n: "15",
      title: t("homestay.privacy.clause_15_title"),
      body: t("homestay.privacy.clause_15_body"),
    },
    {
      n: "16",
      title: t("homestay.privacy.clause_16_title"),
      body: t("homestay.privacy.clause_16_body"),
    },
    {
      n: "17",
      title: t("homestay.privacy.clause_17_title"),
      body: t("homestay.privacy.clause_17_body"),
    },
    {
      n: "18",
      title: t("homestay.privacy.clause_18_title"),
      body: t("homestay.privacy.clause_18_body"),
    },
  ];

  return (
    <HomestayLayout title={t("homestay.privacy.page_title")}>
      <HsPageHero
        eyebrow={t("homestay.privacy.eyebrow")}
        title={t("homestay.privacy.hero_title")}
        lead={<p>{t("homestay.privacy.hero_lead")}</p>}
      />
      <section>
        <div className="max-w-4xl mx-auto px-5 py-12 md:py-16">
          <div className="rounded-xl px-6 py-4 mb-10" style={{ backgroundColor: "#f6efec" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("homestay.privacy.effective_date_label")}</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: HS.darkBrown }}>{EFFECTIVE_DATE}</p>
            <p className="mt-2 text-xs text-gray-500">
              {t("homestay.privacy.effective_date_note")}
            </p>
          </div>

          <div className="space-y-8">
            {CLAUSES.map((c) => (
              <div key={c.n} className="flex gap-4">
                <span className="shrink-0 font-black text-base leading-tight" style={{ color: HS.brand }}>{c.n}</span>
                <div>
                  <h2 className="font-bold text-base mb-1.5" style={{ color: HS.darkBrown }}>{c.title}</h2>
                  <p className="text-sm leading-relaxed text-gray-600">{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl px-6 py-5" style={{ backgroundColor: HS.cream }}>
            <h3 className="text-sm font-bold mb-2" style={{ color: HS.darkBrown }}>{t("homestay.privacy.contact_heading")}</h3>
            <p className="text-sm text-gray-600">{t("homestay.privacy.contact_intro")}</p>
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              <p><span className="font-medium">{t("homestay.privacy.contact_email_label")}</span>{" "}
                <a href="mailto:millionstay.com@gmail.com" className="hover:underline" style={{ color: HS.brand }}>millionstay.com@gmail.com</a>
              </p>
              <p><span className="font-medium">{t("homestay.privacy.contact_website_label")}</span> homestay.millionstay.com</p>
              <p><span className="font-medium">{t("homestay.privacy.contact_address_label")}</span> {t("homestay.privacy.contact_address_value")}</p>
            </div>
          </div>
        </div>
      </section>
    </HomestayLayout>
  );
}
