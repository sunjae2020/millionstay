import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, MapPin, Maximize, BedDouble, Bath, ImageOff } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { usePageContent } from "@/lib/usePageContent";
import { InquiryForm } from "@/components/development/InquiryForm";
import { fetchSaleListings, submitSalesInquiry, type SaleListing } from "@/lib/development-api";

// BUY / SALES — a board of admin-managed 분양(pre-sale) / 판매(sale) listings.
// Each card opens a detail page (/buy/:id) carrying its own inquiry form. The
// hero copy is CMS-managed (dev-buy page); a general sales inquiry stays at the
// bottom for visitors who haven't picked a specific unit.

const CATEGORY_BADGE: Record<string, string> = {
  presale: "bg-primary/10 text-primary",
  sale: "bg-emerald-500/10 text-emerald-700",
};
const STATUS_BADGE: Record<string, string> = {
  available: "bg-green-500/10 text-green-700",
  reserved: "bg-amber-500/10 text-amber-700",
  sold: "bg-gray-200 text-gray-500",
};

function ListingCard({ listing }: { listing: SaleListing }) {
  const { t } = useTranslation();
  return (
    <Link href={`/buy/${listing.id}`} className="group block rounded-2xl bg-white overflow-hidden shadow-sm border border-gray-100 transition hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
          {listing.cover_image
            ? <img src={listing.cover_image} alt={listing.title} className="w-full h-full object-cover transition group-hover:scale-105" />
            : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff className="w-10 h-10" /></div>}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_BADGE[listing.category] ?? "bg-gray-100 text-gray-600"}`}>
              {t(`dev.buy.badge_${listing.category}`, { defaultValue: listing.category })}
            </span>
            {listing.status && listing.status !== "available" && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[listing.status] ?? "bg-gray-100 text-gray-600"}`}>
                {t(`dev.buy.status_${listing.status}`, { defaultValue: listing.status })}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-bold text-[hsl(var(--brand-navy))] line-clamp-1">{listing.title || t("dev.buy.untitled")}</h3>
          {listing.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {listing.location}
            </p>
          )}
          {listing.price_label && <p className="mt-3 font-semibold text-primary">{listing.price_label}</p>}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            {listing.area_m2 != null && <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{listing.area_m2}㎡</span>}
            {listing.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{listing.bedrooms}</span>}
            {listing.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{listing.bathrooms}</span>}
          </div>
        </div>
    </Link>
  );
}

export default function DevBuy() {
  const { t, i18n } = useTranslation();
  const pc = usePageContent("dev-buy");
  const lang = (i18n.language || "en").split("-")[0];
  const [filter, setFilter] = useState<"all" | "presale" | "sale">("all");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["public-sale-listings", lang],
    queryFn: () => fetchSaleListings(lang),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = filter === "all" ? listings : listings.filter((l) => l.category === filter);
  const FILTERS: Array<"all" | "presale" | "sale"> = ["all", "presale", "sale"];

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

      {/* Listings board */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[hsl(var(--brand-navy))] tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" /> {pc("board_title", t("dev.buy.board_title"))}
            </h2>
            <p className="mt-2 text-gray-600">{pc("board_subtitle", t("dev.buy.board_subtitle"))}</p>
          </div>
          {/* Category filter */}
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 self-start">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
                  filter === f ? "bg-primary text-white" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {t(`dev.buy.filter_${f}`)}
              </button>
            ))}
          </div>
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
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              {t("dev.buy.board_empty")}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
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
