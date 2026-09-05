import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Sofa, ShieldCheck, MapPin, Headphones, ArrowRight } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitLongTermInquiry } from "@/lib/development-api";

// FOR RESIDENTS — Metheim variant of the old /for-student page. Targets people
// who want to live in the building (tenants / residents), not students. Funnels
// into a lease consultation (long-term inquiry) and the short-term Rent flow.
// Dev-site only.

const POINTS = [
  { icon: Sofa, key: "1" },
  { icon: ShieldCheck, key: "2" },
  { icon: MapPin, key: "3" },
  { icon: Headphones, key: "4" },
];

export default function DevForResident() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-resident");

  return (
    <DevLayout title={t("dev.resident.hero_title")} pageKey="dev-resident" slug="resident">
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] dev-tex-units text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.resident.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.resident.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.resident.hero_subtitle"))}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/search" className="px-6 py-3 rounded-full font-semibold bg-primary text-white inline-flex items-center gap-2 transition hover:brightness-95">
              {t("dev.resident.cta_browse")} <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#inquiry" className="px-6 py-3 rounded-full font-semibold border border-white/60 bg-white/10 text-white inline-flex items-center gap-2 transition hover:bg-white/20">
              {t("dev.resident.cta_inquiry")}
            </a>
            {/* 이 페이지는 "왜 여기 사는가"를 말한다. 실제 진행 절차 — 어떤 링크가
                언제 오고 무엇을 준비하는지 — 는 /for-tenant 가 맡는다. */}
            <Link href="/for-tenant" className="px-6 py-3 rounded-full font-semibold border border-white/60 bg-white/10 text-white inline-flex items-center gap-2 transition hover:bg-white/20">
              {t("dev.resident.cta_process")}
            </Link>
          </div>
        </div>
      </section>

      {/* Why live here */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("why_title", t("dev.resident.why_title"))}
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-2xl border border-gray-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-[hsl(var(--brand-navy))]">
                {pc(`why_${key}_title`, t(`dev.resident.why_${key}_title`))}
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {pc(`why_${key}_body`, t(`dev.resident.why_${key}_body`))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How to move in */}
      <section className="bg-[hsl(var(--brand-cream))] dev-tex-wave border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("steps_title", t("dev.resident.steps_title"))}
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="rounded-2xl bg-white border border-gray-100 p-6">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold text-sm">{n}</span>
                <h3 className="mt-3 font-semibold text-[hsl(var(--brand-navy))]">
                  {pc(`step_${n}_title`, t(`dev.resident.step_${n}_title`))}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {pc(`step_${n}_body`, t(`dev.resident.step_${n}_body`))}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Inquiry */}
      <section id="inquiry" className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <h2 className="text-center font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("inquiry_title", t("dev.resident.inquiry_title"))}
        </h2>
        <p className="mt-3 text-center text-gray-600">{pc("inquiry_subtitle", t("dev.resident.inquiry_subtitle"))}</p>
        <div className="mt-8">
          <InquiryForm
            submitLabelKey="dev.resident.inquiry_submit"
            extraFields={[
              { name: "unit_type", labelKey: "dev.resident.field_unit_type", placeholderKey: "dev.resident.field_unit_type_ph" },
              { name: "move_in", labelKey: "dev.resident.field_move_in", placeholderKey: "dev.resident.field_move_in_ph" },
              { name: "duration_months", labelKey: "dev.resident.field_duration", placeholderKey: "dev.resident.field_duration_ph" },
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
