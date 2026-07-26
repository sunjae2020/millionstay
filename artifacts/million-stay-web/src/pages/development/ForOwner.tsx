import { useTranslation } from "react-i18next";
import { TrendingUp, Wrench, FileCheck2, Wallet } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitManagementInquiry } from "@/lib/development-api";

// FOR OWNERS — Metheim variant of the old /for-homestay-host page. Targets unit
// owners / landlords who want Metheim to lease and manage their unit, NOT
// homestay hosts. Funnels into the entrusted-management application. Dev-site only.

const BENEFITS = [
  { icon: TrendingUp, key: "1" },
  { icon: Wrench, key: "2" },
  { icon: FileCheck2, key: "3" },
  { icon: Wallet, key: "4" },
];

export default function DevForOwner() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-owner");

  return (
    <DevLayout title={t("dev.owner.hero_title")}>
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.owner.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.owner.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.owner.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("benefits_title", t("dev.owner.benefits_title"))}
        </h2>
        <p className="mt-3 text-gray-600 max-w-2xl leading-relaxed">{pc("benefits_body", t("dev.owner.benefits_body"))}</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-2xl border border-gray-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-[hsl(var(--brand-navy))]">
                {pc(`benefit_${key}_title`, t(`dev.owner.benefit_${key}_title`))}
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {pc(`benefit_${key}_body`, t(`dev.owner.benefit_${key}_body`))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("how_title", t("dev.owner.how_title"))}
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="rounded-2xl bg-white border border-gray-100 p-6">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold text-sm">{n}</span>
                <h3 className="mt-3 font-semibold text-[hsl(var(--brand-navy))]">
                  {pc(`how_${n}_title`, t(`dev.owner.how_${n}_title`))}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {pc(`how_${n}_body`, t(`dev.owner.how_${n}_body`))}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-gray-500">{t("dev.owner.mgmt_link_note")}</p>
        </div>
      </section>

      {/* Inquiry — entrusted management application */}
      <section id="inquiry" className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <h2 className="text-center font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("inquiry_title", t("dev.owner.inquiry_title"))}
        </h2>
        <p className="mt-3 text-center text-gray-600">{pc("inquiry_subtitle", t("dev.owner.inquiry_subtitle"))}</p>
        <div className="mt-8">
          <InquiryForm
            submitLabelKey="dev.owner.inquiry_submit"
            extraFields={[
              { name: "unit_type", labelKey: "dev.owner.field_unit_type", placeholderKey: "dev.owner.field_unit_type_ph" },
              { name: "ownership", labelKey: "dev.owner.field_ownership", placeholderKey: "dev.owner.field_ownership_ph" },
            ]}
            onSubmit={(v) => submitManagementInquiry({
              first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
              unit_type: v.unit_type, ownership: v.ownership, message: v.message,
            })}
          />
        </div>
      </section>
    </DevLayout>
  );
}
