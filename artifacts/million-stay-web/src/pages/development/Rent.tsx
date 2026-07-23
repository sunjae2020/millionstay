import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { CalendarDays, ArrowRight, FileSignature, Home as HomeIcon } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { submitLongTermInquiry } from "@/lib/development-api";
import { useListFeaturedSpaces } from "@/lib/guest-api";

// RENT / STAY — two tracks:
//   · Short-term (단기): the existing calendar booking engine (search →
//     space-detail → booking). This page surfaces it (featured rooms + Browse CTA);
//     the actual routes are mounted in DevRouter so the flow works end to end.
//   · Long-term (장기): a lease consultation form (#long-term) → lands as a lead.

export default function DevRent() {
  const { t } = useTranslation();
  const pc = usePageContent("dev-rent");
  const { data } = useListFeaturedSpaces();
  const spaces = (data?.data ?? []).slice(0, 4);

  return (
    <DevLayout title={t("dev.rent.hero_title")}>
      {/* Hero */}
      <section className="bg-[hsl(var(--brand-navy))] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{t("dev.rent.eyebrow")}</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">
            {pc("hero_title", t("dev.rent.hero_title"))}
          </h1>
          <p className="mt-5 text-lg text-white/90 max-w-2xl leading-relaxed">
            {pc("hero_subtitle", t("dev.rent.hero_subtitle"))}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#short-term" className="px-6 py-3 rounded-full font-semibold bg-primary text-white inline-flex items-center gap-2 transition hover:brightness-95">
              {t("dev.rent.short_title")}
            </a>
            <a href="#long-term" className="px-6 py-3 rounded-full font-semibold border border-white/60 bg-white/10 text-white inline-flex items-center gap-2 transition hover:bg-white/20">
              {t("dev.rent.long_title")}
            </a>
          </div>
        </div>
      </section>

      {/* Short-term — hotel-style calendar booking */}
      <section id="short-term" className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("short_title", t("dev.rent.short_heading"))}
            </h2>
            <p className="mt-2 text-gray-600 max-w-2xl leading-relaxed">{pc("short_body", t("dev.rent.short_body"))}</p>
          </div>
        </div>

        {spaces.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {spaces.map((s: any) => {
              const img = s.primary_thumbnail || s.primary_image || (s.images?.[0]?.thumbnail_url) || (s.images?.[0]?.file_url) || "";
              const city = [s.suburb_name, s.property_city].filter(Boolean).join(", ");
              return (
                <Link key={s.id} href={`/spaces/${s.id}`} className="group rounded-2xl bg-white overflow-hidden border border-gray-100 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  {img
                    ? <img src={img} alt={s.name} className="w-full aspect-[4/3] object-cover bg-gray-50" />
                    : <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-300"><HomeIcon className="w-10 h-10" /></div>}
                  <div className="p-4">
                    <h3 className="font-semibold text-[hsl(var(--brand-navy))] truncate">{s.name}</h3>
                    {city && <p className="mt-1 text-sm text-gray-500 truncate">{city}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <Link href="/search" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold bg-primary text-white transition hover:brightness-95">
            {t("dev.rent.short_cta")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Long-term — lease consultation */}
      <section id="long-term" className="bg-[hsl(var(--brand-cream))] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20 grid gap-10 lg:grid-cols-2 items-start">
          <div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FileSignature className="w-5 h-5" />
            </div>
            <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight">
              {pc("long_title", t("dev.rent.long_heading"))}
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">{pc("long_body", t("dev.rent.long_body"))}</p>
            <ul className="mt-6 space-y-2.5">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {pc(`long_point_${n}`, t(`dev.rent.long_point_${n}`))}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <InquiryForm
              submitLabelKey="dev.rent.long_submit"
              extraFields={[
                { name: "unit_type", labelKey: "dev.rent.field_unit_type", placeholderKey: "dev.rent.field_unit_type_ph" },
                { name: "move_in", labelKey: "dev.rent.field_move_in", placeholderKey: "dev.rent.field_move_in_ph" },
                { name: "duration_months", labelKey: "dev.rent.field_duration", placeholderKey: "dev.rent.field_duration_ph" },
              ]}
              onSubmit={(v) => submitLongTermInquiry({
                first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
                unit_type: v.unit_type, move_in: v.move_in, duration_months: v.duration_months, message: v.message,
              })}
            />
          </div>
        </div>
      </section>
    </DevLayout>
  );
}
