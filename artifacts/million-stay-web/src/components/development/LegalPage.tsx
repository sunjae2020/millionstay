import { useTranslation } from "react-i18next";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { useCompanyContact } from "@/lib/guest-api";

// Shared layout for the Metheim (Korea) legal documents — 개인정보처리방침 /
// 이용약관. Each renders a badge + title + effective date + intro, then a run of
// numbered "title + body" sections (blank a title in the CMS to hide a section),
// then the operator / company info block that is shared with the footer
// (usePageContent("dev-footer")). Bodies are textareas so line breaks matter →
// rendered with `whitespace-pre-line`.

const MAX_SECTIONS = 12;

export function LegalPage({ pageKey, ns }: { pageKey: "dev-privacy" | "dev-terms"; ns: "privacy" | "terms" }) {
  // The CMS slug matches the namespace ("privacy" / "terms"), so publishing a
  // block version of either page replaces the sections below.
  const slug = ns;
  const { t } = useTranslation();
  const pc = usePageContent(pageKey);
  const company = usePageContent("dev-footer");
  const org = useCompanyContact();

  const sections = Array.from({ length: MAX_SECTIONS }, (_, idx) => {
    const n = idx + 1;
    return {
      title: pc(`s${n}_title`, t(`dev.${ns}.s${n}_title`, { defaultValue: "" })),
      body: pc(`s${n}_body`, t(`dev.${ns}.s${n}_body`, { defaultValue: "" })),
    };
  }).filter((s) => s.title || s.body);

  // Precedence: Settings → Organisation value if set, else CMS "dev-footer"
  // overlay, else the localized i18n default.
  const infoAll: Array<[string, string]> = [
    [t("dev.footer.company_name_label"), org.companyName || company("company_name", t("dev.footer.company_name"))],
    [t("dev.footer.ceo_label"), org.ceo || company("ceo", t("dev.footer.ceo"))],
    [t("dev.footer.biz_no_label"), org.bizNo || company("biz_no", t("dev.footer.biz_no"))],
    [t("dev.footer.address_label"), org.address || company("address", t("dev.footer.address"))],
    [t("dev.footer.phone_label"), org.phone || company("phone", t("dev.footer.phone"))],
    [t("dev.footer.email_label"), org.email || company("email", t("dev.footer.email"))],
    [t("dev.footer.homepage_label"), org.website || company("homepage", t("dev.footer.homepage"))],
    [t("dev.footer.privacy_officer_label"), org.privacyOfficer || company("privacy_officer", t("dev.footer.privacy_officer"))],
  ];
  const info = infoAll.filter(([, v]) => v);

  return (
    <DevLayout title={pc("title", t(`dev.${ns}.title`))} pageKey={pageKey} slug={slug}>
      {/* Header */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/70">{t(`dev.${ns}.badge`)}</p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-extrabold tracking-tight">{pc("title", t(`dev.${ns}.title`))}</h1>
          <p className="mt-4 text-sm text-white/70">{pc("updated", t(`dev.${ns}.updated`))}</p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <p className="text-gray-600 leading-relaxed whitespace-pre-line">{pc("intro", t(`dev.${ns}.intro`))}</p>

        <div className="mt-10 space-y-9">
          {sections.map((s, i) => (
            <div key={i}>
              <h2 className="font-display text-lg md:text-xl font-bold text-[hsl(var(--brand-navy))]">{s.title}</h2>
              <p className="mt-3 text-sm md:text-[15px] text-gray-600 leading-relaxed whitespace-pre-line">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Operator / company info */}
        {info.length > 0 && (
          <div className="mt-12 rounded-2xl border border-gray-200 bg-[hsl(var(--brand-cream))] p-6 sm:p-8">
            <h2 className="font-semibold text-[hsl(var(--brand-navy))]">{t("dev.footer.company_heading")}</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
              {info.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="shrink-0 text-gray-500">{label}</dt>
                  <dd className="text-gray-800 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </DevLayout>
  );
}
