import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS } from "@/lib/homestay-theme";
import { EFFECTIVE_DATE } from "@/lib/homestay-terms-content";

type Clause = { n: string; title: ReactNode; body: ReactNode };

// Terms of Service for homestay.millionstay.com. The clause content lives in
// lib/homestay-terms-content.tsx so it can be reused inside the scroll-to-agree
// box on the student and host application forms.
export default function HomestayTerms() {
  const { t } = useTranslation();

  const CLAUSES: Clause[] = [
    {
      n: "01",
      title: t("homestay.terms.clause_1_title"),
      body: t("homestay.terms.clause_1_body"),
    },
    {
      n: "02",
      title: t("homestay.terms.clause_2_title"),
      body: t("homestay.terms.clause_2_body"),
    },
    {
      n: "03",
      title: t("homestay.terms.clause_3_title"),
      body: t("homestay.terms.clause_3_body"),
    },
    {
      n: "04",
      title: t("homestay.terms.clause_4_title"),
      body: t("homestay.terms.clause_4_body"),
    },
    {
      n: "05",
      title: t("homestay.terms.clause_5_title"),
      body: t("homestay.terms.clause_5_body"),
    },
    {
      n: "06",
      title: t("homestay.terms.clause_6_title"),
      body: t("homestay.terms.clause_6_body"),
    },
    {
      n: "07",
      title: t("homestay.terms.clause_7_title"),
      body: t("homestay.terms.clause_7_body"),
    },
    {
      n: "08",
      title: t("homestay.terms.clause_8_title"),
      body: t("homestay.terms.clause_8_body"),
    },
    {
      n: "09",
      title: t("homestay.terms.clause_9_title"),
      body: t("homestay.terms.clause_9_body"),
    },
    {
      n: "10",
      title: t("homestay.terms.clause_10_title"),
      body: t("homestay.terms.clause_10_body"),
    },
    {
      n: "11",
      title: t("homestay.terms.clause_11_title"),
      body: t("homestay.terms.clause_11_body"),
    },
    {
      n: "12",
      title: t("homestay.terms.clause_12_title"),
      body: t("homestay.terms.clause_12_body"),
    },
    {
      n: "13",
      title: t("homestay.terms.clause_13_title"),
      body: t("homestay.terms.clause_13_body"),
    },
    {
      n: "14",
      title: t("homestay.terms.clause_14_title"),
      body: t("homestay.terms.clause_14_body"),
    },
    {
      n: "15",
      title: t("homestay.terms.clause_15_title"),
      body: t("homestay.terms.clause_15_body"),
    },
    {
      n: "16",
      title: t("homestay.terms.clause_16_title"),
      body: t("homestay.terms.clause_16_body"),
    },
  ];

  return (
    <HomestayLayout title={t("homestay.terms.page_title")}>
      <HsPageHero
        eyebrow={t("homestay.terms.eyebrow")}
        title={t("homestay.terms.hero_title")}
        lead={<p>{t("homestay.terms.hero_lead")}</p>}
      />
      <section>
        <div className="max-w-4xl mx-auto px-5 py-12 md:py-16">
          <div className="rounded-xl px-6 py-4 mb-10" style={{ backgroundColor: "#f6efec" }}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("homestay.terms.effective_date_label")}</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: HS.darkBrown }}>{EFFECTIVE_DATE}</p>
            <p className="mt-2 text-xs text-gray-500">
              {t("homestay.terms.effective_date_note")}
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
        </div>
      </section>
    </HomestayLayout>
  );
}
