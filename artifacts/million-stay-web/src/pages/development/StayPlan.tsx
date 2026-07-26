import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { CalendarDays, CalendarRange, KeyRound, ArrowRight } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitLongTermInquiry } from "@/lib/development-api";

// STAY & LEASE PLANS — Metheim variant of the old /stay-plan page. Explains the
// three ways to stay in the building (nightly / monthly / long-term lease) and
// funnels into the shared short-term engine (/search) or a lease consultation.
// Replaces the MillionStay marketplace pricing page. Dev-site only.

export default function DevStayPlan() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-stayplan");

  const PLANS = [
    { icon: CalendarDays, key: "nightly", cta: "/search" },
    { icon: CalendarRange, key: "monthly", cta: "/search" },
    { icon: KeyRound, key: "lease", cta: "#inquiry" },
  ];

  return (
    <DevLayout title={t("dev.stayplan.hero_title")}>
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.stayplan.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.stayplan.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.stayplan.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Three plans */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map(({ icon: Icon, key, cta }) => (
            <div key={key} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-[hsl(var(--brand-navy))]">
                {pc(`plan_${key}_title`, t(`dev.stayplan.plan_${key}_title`))}
              </h3>
              <p className="mt-1 text-sm font-semibold text-primary">
                {pc(`plan_${key}_term`, t(`dev.stayplan.plan_${key}_term`))}
              </p>
              <p className="mt-3 flex-1 text-sm text-gray-600 leading-relaxed">
                {pc(`plan_${key}_body`, t(`dev.stayplan.plan_${key}_body`))}
              </p>
              <Link
                href={cta}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--brand-navy))] hover:text-primary transition"
              >
                {t(`dev.stayplan.plan_${key}_cta`)} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Included */}
      <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("included_title", t("dev.stayplan.included_title"))}
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="rounded-xl bg-white border border-gray-100 p-5 text-sm text-gray-700">
                <span className="font-semibold text-[hsl(var(--brand-navy))] block mb-1">
                  {pc(`included_${n}_title`, t(`dev.stayplan.included_${n}_title`))}
                </span>
                {pc(`included_${n}_body`, t(`dev.stayplan.included_${n}_body`))}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Lease inquiry */}
      <section id="inquiry" className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <h2 className="text-center font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("inquiry_title", t("dev.stayplan.inquiry_title"))}
        </h2>
        <p className="mt-3 text-center text-gray-600">{pc("inquiry_subtitle", t("dev.stayplan.inquiry_subtitle"))}</p>
        <div className="mt-8">
          <InquiryForm
            submitLabelKey="dev.stayplan.inquiry_submit"
            extraFields={[
              { name: "unit_type", labelKey: "dev.stayplan.field_unit_type", placeholderKey: "dev.stayplan.field_unit_type_ph" },
              { name: "move_in", labelKey: "dev.stayplan.field_move_in", placeholderKey: "dev.stayplan.field_move_in_ph" },
              { name: "duration_months", labelKey: "dev.stayplan.field_duration", placeholderKey: "dev.stayplan.field_duration_ph" },
            ]}
            onSubmit={(v) => submitLongTermInquiry({
              first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
              unit_type: v.unit_type, move_in: v.move_in, duration_months: v.duration_months, message: v.message,
            })}
          />
        </div>
      </section>
    </DevLayout>
  );
}
