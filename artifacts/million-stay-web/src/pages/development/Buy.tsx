import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, ArrowRight } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { ListingCard } from "@/components/development/ListingCard";
import { fetchSaleListings, submitSalesInquiry } from "@/lib/development-api";

// BUY / SALES — the main page shows a preview of the newest 분양(pre-sale) /
// 판매(sale) listings (3), with a link to the full board (/buy/list). Each card
// opens a detail page (/buy/:id) carrying its own inquiry form. The hero copy is
// CMS-managed; a general sales inquiry stays at the bottom for visitors who
// haven't picked a specific unit.

const PREVIEW_COUNT = 3;

export default function DevBuy() {
  const { t, i18n } = useTranslation();
  const pc = usePageContent("dev-buy");
  const lang = (i18n.language || "en").split("-")[0];

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["public-sale-listings", lang],
    queryFn: () => fetchSaleListings(lang),
    staleTime: 2 * 60 * 1000,
  });

  const preview = listings.slice(0, PREVIEW_COUNT);

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

      {/* Listings preview (newest 3) */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" /> {pc("board_title", t("dev.buy.board_title"))}
            </h2>
            <p className="mt-2 text-gray-600">{pc("board_subtitle", t("dev.buy.board_subtitle"))}</p>
          </div>
          <Link href="/buy/list" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:gap-2.5 transition-all">
            {t("dev.buy.view_all")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-gray-100" />
                  <div className="p-5 space-y-3"><div className="h-4 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : preview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              {t("dev.buy.board_empty")}
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {preview.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
              {listings.length > PREVIEW_COUNT && (
                <div className="mt-10 text-center">
                  <Link href="/buy/list" className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-6 py-3 font-semibold text-primary transition hover:bg-primary/5">
                    {t("dev.buy.view_all")} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* General inquiry (not tied to a specific listing) */}
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
