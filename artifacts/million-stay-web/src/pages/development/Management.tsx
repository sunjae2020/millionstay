import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, ShieldCheck, Wrench, Wallet, Calculator, PiggyBank, BarChart3, Users } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { SectionHeading, WhyGrid, ProcessZigzag } from "@/components/development/marketing";
import { submitManagementInquiry, computeYield } from "@/lib/development-api";
import { DEFAULT_CURRENCY } from "@/lib/defaultCurrency";

// MANAGEMENT / 위탁관리 — owner-facing: vacancy management, an indicative yield
// simulator (client-side, transparent assumptions), and the entrusted-management
// application (lands as a lead). Assumption defaults are tunable here.

const CURRENCY = DEFAULT_CURRENCY || "KRW";

function useMoneyFmt() {
  const { i18n } = useTranslation();
  return useMemo(
    () => new Intl.NumberFormat(i18n.language || "ko", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }),
    [i18n.language],
  );
}

function YieldSimulator() {
  const { t } = useTranslation();
  const fmt = useMoneyFmt();
  const [purchasePrice, setPurchasePrice] = useState(200_000_000);
  const [monthlyRent, setMonthlyRent] = useState(900_000);
  const [occupancyPct, setOccupancyPct] = useState(90);
  const [mgmtFeePct, setMgmtFeePct] = useState(10);
  const [monthlyCosts, setMonthlyCosts] = useState(100_000);

  const r = computeYield({ purchasePrice, monthlyRent, occupancyPct, mgmtFeePct, monthlyCosts });

  const Field = ({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center rounded-lg border border-gray-200 bg-white focus-within:border-primary">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm min-w-0"
        />
        {suffix && <span className="px-3 text-sm text-gray-400 shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8 grid gap-4 sm:grid-cols-2">
        <Field label={t("dev.mgmt.sim_price")} value={purchasePrice} onChange={setPurchasePrice} suffix={CURRENCY} />
        <Field label={t("dev.mgmt.sim_rent")} value={monthlyRent} onChange={setMonthlyRent} suffix={CURRENCY} />
        <Field label={t("dev.mgmt.sim_occupancy")} value={occupancyPct} onChange={setOccupancyPct} suffix="%" />
        <Field label={t("dev.mgmt.sim_fee")} value={mgmtFeePct} onChange={setMgmtFeePct} suffix="%" />
        <Field label={t("dev.mgmt.sim_costs")} value={monthlyCosts} onChange={setMonthlyCosts} suffix={CURRENCY} />
      </div>
      <div className="bg-[hsl(var(--brand-navy))] text-white p-6 sm:p-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">{t("dev.mgmt.sim_net_yield")}</p>
          <p className="mt-1 text-3xl font-extrabold text-primary-foreground" style={{ color: "hsl(var(--brand-apricot))" }}>
            {r.netYieldPct.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">{t("dev.mgmt.sim_net_annual")}</p>
          <p className="mt-1 text-xl font-bold">{fmt.format(Math.round(r.netAnnualIncome))}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">{t("dev.mgmt.sim_net_monthly")}</p>
          <p className="mt-1 text-xl font-bold">{fmt.format(Math.round(r.monthlyNetIncome))}</p>
        </div>
      </div>
      <p className="px-6 sm:px-8 py-3 text-xs text-gray-400 bg-gray-50">{t("dev.mgmt.sim_disclaimer")}</p>
    </div>
  );
}

export default function DevManagement() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-manage");

  const BENEFITS = [
    { icon: Wrench, title: pc("benefit_1_title", t("dev.mgmt.benefit_1_title")), body: pc("benefit_1_body", t("dev.mgmt.benefit_1_body")) },
    { icon: ShieldCheck, title: pc("benefit_2_title", t("dev.mgmt.benefit_2_title")), body: pc("benefit_2_body", t("dev.mgmt.benefit_2_body")) },
    { icon: Wallet, title: pc("benefit_3_title", t("dev.mgmt.benefit_3_title")), body: pc("benefit_3_body", t("dev.mgmt.benefit_3_body")) },
  ];

  const WHY = [
    { icon: PiggyBank, title: pc("why_1_title", t("dev.mgmt.why_1_title")), body: pc("why_1_body", t("dev.mgmt.why_1_body")) },
    { icon: BarChart3, title: pc("why_2_title", t("dev.mgmt.why_2_title")), body: pc("why_2_body", t("dev.mgmt.why_2_body")) },
    { icon: Users, title: pc("why_3_title", t("dev.mgmt.why_3_title")), body: pc("why_3_body", t("dev.mgmt.why_3_body")) },
  ];
  const STEPS = [1, 2, 3, 4].map((n) => ({
    title: pc(`step_${n}_title`, t(`dev.mgmt.step_${n}_title`)),
    body: pc(`step_${n}_body`, t(`dev.mgmt.step_${n}_body`)),
  }));

  return (
    <DevLayout title={t("dev.mgmt.hero_title")}>
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.mgmt.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.mgmt.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.mgmt.hero_subtitle"))}
          </p>
        </div>
      </section>

      {/* Vacancy management / benefits */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight text-center">
          {pc("benefits_heading", t("dev.mgmt.benefits_heading"))}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-gray-200 p-7">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg text-[hsl(var(--brand-navy))]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why MetHeim — 위탁관리 */}
      <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <SectionHeading
            eyebrow={pc("why_eyebrow", t("dev.mgmt.why_eyebrow"))}
            title={pc("why_heading", t("dev.mgmt.why_heading"))}
            subtitle={pc("why_subtitle", t("dev.mgmt.why_subtitle"))}
          />
          <WhyGrid items={WHY} />
        </div>
      </section>

      {/* Yield simulator */}
      <section id="simulator" className="bg-white">
        <div className="max-w-4xl mx-auto px-6 py-14 md:py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-primary font-semibold">
              <Calculator className="w-5 h-5" /> {t("dev.mgmt.sim_eyebrow")}
            </div>
            <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("sim_title", t("dev.mgmt.sim_title"))}
            </h2>
            <p className="mt-3 text-gray-600">{pc("sim_subtitle", t("dev.mgmt.sim_subtitle"))}</p>
          </div>
          <div className="mt-8">
            <YieldSimulator />
          </div>
        </div>
      </section>

      {/* 위탁 절차 — alternating zig-zag */}
      <section className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <SectionHeading
            eyebrow={pc("process_eyebrow", t("dev.mgmt.process_eyebrow"))}
            title={pc("process_heading", t("dev.mgmt.process_heading"))}
            subtitle={pc("process_subtitle", t("dev.mgmt.process_subtitle"))}
          />
          <ProcessZigzag steps={STEPS} />
        </div>
      </section>

      {/* Application */}
      <section id="apply" className="max-w-3xl mx-auto px-6 py-14 md:py-20">
        <div className="flex items-center justify-center gap-2 text-primary">
          <LineChart className="w-5 h-5" />
          <span className="font-semibold">{t("dev.mgmt.apply_eyebrow")}</span>
        </div>
        <h2 className="mt-3 text-center font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
          {pc("apply_title", t("dev.mgmt.apply_title"))}
        </h2>
        <p className="mt-3 text-center text-gray-600">{pc("apply_subtitle", t("dev.mgmt.apply_subtitle"))}</p>
        <div className="mt-8">
          <InquiryForm
            submitLabelKey="dev.mgmt.apply_submit"
            extraFields={[
              { name: "unit_type", labelKey: "dev.mgmt.field_unit_type", placeholderKey: "dev.mgmt.field_unit_type_ph" },
              { name: "ownership", labelKey: "dev.mgmt.field_ownership", placeholderKey: "dev.mgmt.field_ownership_ph" },
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
