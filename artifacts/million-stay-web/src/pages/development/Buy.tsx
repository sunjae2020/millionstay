import { useTranslation } from "react-i18next";
import { Building2, FileText, CheckCircle2 } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitSalesInquiry } from "@/lib/development-api";

// BUY / SALES — 분양가·평면도·잔여 세대 안내 + 분양/매매 문의. Inventory is
// content-managed (no live unit table in this phase): floor-plan images, price
// rows and the "remaining units" note are all CMS fields, editable per-locale.

export default function DevBuy() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-buy");

  // Up to four floor plans — each an image URL + label + area + price, all CMS.
  const PLANS = [1, 2, 3, 4]
    .map((n) => ({
      img: pc(`plan_${n}_image`, ""),
      name: pc(`plan_${n}_name`, ""),
      area: pc(`plan_${n}_area`, ""),
      price: pc(`plan_${n}_price`, ""),
      status: pc(`plan_${n}_status`, ""),
    }))
    .filter((p) => p.name || p.img);

  return (
    <DevLayout title={t("dev.buy.hero_title")}>
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.buy.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.buy.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.buy.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Overview / pricing intro */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-2 items-start">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("overview_title", t("dev.buy.overview_title"))}
            </h2>
            <div className="mt-4 space-y-3 text-gray-600 leading-relaxed">
              <p>{pc("overview_p1", t("dev.buy.overview_p1"))}</p>
              <p>{pc("overview_p2", t("dev.buy.overview_p2"))}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-7">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="w-5 h-5" />
              <span className="font-semibold">{t("dev.buy.remaining_label")}</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-[hsl(var(--brand-navy))]">
              {pc("remaining_units", t("dev.buy.remaining_default"))}
            </p>
            <p className="mt-2 text-sm text-gray-600">{pc("remaining_note", t("dev.buy.remaining_note"))}</p>
          </div>
        </div>
      </section>

      {/* Floor plans */}
      {PLANS.length > 0 && (
        <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> {pc("plans_title", t("dev.buy.plans_title"))}
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p, i) => (
                <div key={i} className="rounded-2xl bg-white overflow-hidden shadow-sm border border-gray-100">
                  {p.img
                    ? <img src={p.img} alt={p.name} className="w-full aspect-[4/3] object-cover bg-gray-50" />
                    : <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-300"><FileText className="w-10 h-10" /></div>}
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[hsl(var(--brand-navy))]">{p.name}</h3>
                      {p.status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.status}</span>}
                    </div>
                    {p.area && <p className="mt-1 text-sm text-gray-500">{p.area}</p>}
                    {p.price && <p className="mt-2 font-semibold text-primary">{p.price}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Highlights */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((n) => {
            const title = pc(`highlight_${n}_title`, t(`dev.buy.highlight_${n}_title`));
            const body = pc(`highlight_${n}_body`, t(`dev.buy.highlight_${n}_body`));
            return (
              <div key={n} className="rounded-2xl border border-gray-200 p-6">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                <h3 className="mt-3 font-semibold text-[hsl(var(--brand-navy))]">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inquiry */}
      <section id="inquiry" className="bg-[hsl(var(--brand-cream))] border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <h2 className="text-center font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
            {pc("inquiry_title", t("dev.buy.inquiry_title"))}
          </h2>
          <p className="mt-3 text-center text-gray-600">{pc("inquiry_subtitle", t("dev.buy.inquiry_subtitle"))}</p>
          <div className="mt-8">
            <InquiryForm
              submitLabelKey="dev.buy.inquiry_submit"
              extraFields={[
                { name: "unit_type", labelKey: "dev.buy.field_unit_type", placeholderKey: "dev.buy.field_unit_type_ph" },
                { name: "budget", labelKey: "dev.buy.field_budget" },
                { name: "purpose", labelKey: "dev.buy.field_purpose", placeholderKey: "dev.buy.field_purpose_ph" },
              ]}
              onSubmit={(v) => submitSalesInquiry({
                first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
                unit_type: v.unit_type, budget: v.budget, purpose: v.purpose, message: v.message,
              })}
            />
          </div>
        </div>
      </section>
    </DevLayout>
  );
}
