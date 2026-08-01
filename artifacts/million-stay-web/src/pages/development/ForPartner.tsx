import { useTranslation } from "react-i18next";
import { Handshake, Percent, Building2 } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitContactInquiry } from "@/lib/development-api";

// FOR PARTNERS — Metheim variant of the old /for-agent page. Targets real-estate
// agents / referral partners who introduce buyers or tenants to the building,
// NOT education agents. Lands as a general contact lead. Dev-site only.

const BENEFITS = [
  { icon: Percent, key: "1" },
  { icon: Building2, key: "2" },
  { icon: Handshake, key: "3" },
];

export default function DevForPartner() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-partner");

  return (
    <DevLayout title={t("dev.partner.hero_title")} pageKey="dev-partner">
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] dev-tex-units text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.partner.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.partner.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.partner.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Why partner */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("why_title", t("dev.partner.why_title"))}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-2xl border border-gray-200 p-7">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-[hsl(var(--brand-navy))]">
                {pc(`why_${key}_title`, t(`dev.partner.why_${key}_title`))}
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {pc(`why_${key}_body`, t(`dev.partner.why_${key}_body`))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Inquiry — general contact lead */}
      <section id="inquiry" className="bg-[hsl(var(--brand-cream))] dev-tex-wave border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <h2 className="text-center font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("inquiry_title", t("dev.partner.inquiry_title"))}
          </h2>
          <p className="mt-3 text-center text-gray-600">{pc("inquiry_subtitle", t("dev.partner.inquiry_subtitle"))}</p>
          <div className="mt-8">
            <InquiryForm
              submitLabelKey="dev.partner.inquiry_submit"
              requireMessage
              extraFields={[
                { name: "subject", labelKey: "dev.partner.field_company", placeholderKey: "dev.partner.field_company_ph" },
              ]}
              onSubmit={(v) => submitContactInquiry({
                first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
                subject: v.subject, message: v.message ?? "",
              })}
            />
          </div>
        </div>
      </section>
    </DevLayout>
  );
}
