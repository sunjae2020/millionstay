import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, ArrowLeft } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { ListingCard } from "@/components/development/ListingCard";
import { fetchSaleListings } from "@/lib/development-api";

// BUY / LIST — the full 분양/판매 board with 전체/분양/판매 filter tabs. A
// `?category=presale|sale` query param pre-selects the matching tab (so a
// "분양 전체보기" link lands filtered).

type Filter = "all" | "presale" | "sale";
const FILTERS: Filter[] = ["all", "presale", "sale"];

function initialFilter(): Filter {
  if (typeof window === "undefined") return "all";
  const c = new URLSearchParams(window.location.search).get("category");
  return c === "presale" || c === "sale" ? c : "all";
}

export default function DevBuyList() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0];
  const [filter, setFilter] = useState<Filter>(initialFilter);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["public-sale-listings", lang],
    queryFn: () => fetchSaleListings(lang),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = filter === "all" ? listings : listings.filter((l) => l.category === filter);

  return (
    <DevLayout title={t("dev.buy.list_title")} pageKey="dev-buy">
      <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
        <Link href="/buy" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition">
          <ArrowLeft className="w-4 h-4" /> {t("dev.buy.back_to_buy")}
        </Link>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-[hsl(var(--brand-navy))] flex items-center gap-2">
              <Building2 className="w-7 h-7 text-primary" /> {t("dev.buy.list_title")}
            </h1>
            <p className="mt-2 text-gray-600">{t("dev.buy.list_subtitle")}</p>
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
              {[0, 1, 2, 3, 4, 5].map((i) => (
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
            <>
              <p className="mb-6 text-sm text-gray-500">{t("dev.buy.result_count", { count: filtered.length })}</p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            </>
          )}
        </div>
      </section>
    </DevLayout>
  );
}
