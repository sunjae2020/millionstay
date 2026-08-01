import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Maximize, BedDouble, Bath, ImageOff, Loader2 } from "lucide-react";
import { DevLayout } from "@/components/development/DevLayout";
import { InquiryForm } from "@/components/development/InquiryForm";
import { PriceFxBreakdown } from "@/components/development/PriceFxBreakdown";
import { fetchSaleListing, submitListingInquiry } from "@/lib/development-api";

// Detail page for one 분양/판매 listing. Renders gallery + specs + description
// and a listing-scoped inquiry form (the lead is tagged with this listing).

const CATEGORY_BADGE: Record<string, string> = {
  presale: "bg-primary/10 text-primary",
  sale: "bg-emerald-500/10 text-emerald-700",
};
const STATUS_BADGE: Record<string, string> = {
  available: "bg-green-500/10 text-green-700",
  reserved: "bg-amber-500/10 text-amber-700",
  sold: "bg-gray-200 text-gray-500",
};

export default function DevBuyDetail() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const lang = (i18n.language || "en").split("-")[0];
  const [activeImg, setActiveImg] = useState(0);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["public-sale-listing", id, lang],
    queryFn: () => fetchSaleListing(id, lang),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const images = listing
    ? [listing.cover_image, ...(listing.gallery ?? [])].filter((u): u is string => !!u)
    : [];
  // De-dup cover if it's also first in the gallery.
  const gallery = images.filter((u, i) => images.indexOf(u) === i);

  return (
    <DevLayout title={listing?.title ?? t("dev.buy.hero_title")} pageKey="dev-buy">
      <div className="max-w-7xl mx-auto px-6 py-8 md:py-12">
        <Link href="/buy" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition">
          <ArrowLeft className="w-4 h-4" /> {t("dev.listing.back_to_list")}
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !listing ? (
          <div className="py-32 text-center text-gray-400">
            <ImageOff className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t("dev.listing.not_found")}</p>
            <Link href="/buy" className="mt-4 inline-block text-primary hover:underline">{t("dev.listing.back_to_list")}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-10 lg:grid-cols-5">
            {/* Left: gallery + description */}
            <div className="lg:col-span-3 space-y-8">
              <div>
                <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
                  {gallery.length > 0
                    ? <img src={gallery[activeImg]} alt={listing.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff className="w-12 h-12" /></div>}
                </div>
                {gallery.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        onClick={() => setActiveImg(i)}
                        className={`h-16 w-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition ${
                          i === activeImg ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {listing.description && (
                <div>
                  <h2 className="font-display text-xl font-bold text-[hsl(var(--brand-navy))]">{t("dev.listing.about")}</h2>
                  <p className="mt-3 text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
                </div>
              )}
            </div>

            {/* Right: summary + inquiry */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_BADGE[listing.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {t(`dev.buy.badge_${listing.category}`, { defaultValue: listing.category })}
                  </span>
                  {listing.status && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[listing.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`dev.buy.status_${listing.status}`, { defaultValue: listing.status })}
                    </span>
                  )}
                </div>
                <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-[hsl(var(--brand-navy))]">
                  {listing.title || t("dev.buy.untitled")}
                </h1>
                {listing.subtitle && <p className="mt-1 text-gray-500">{listing.subtitle}</p>}
                {listing.location && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" /> {listing.location}
                  </p>
                )}
                {listing.price_label && <p className="mt-4 text-2xl font-extrabold text-primary">{listing.price_label}</p>}
                <PriceFxBreakdown amount={listing.price_amount} className="mt-2" />

                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-gray-100 pt-5 text-center">
                  <div>
                    <Maximize className="w-4 h-4 mx-auto text-primary" />
                    <p className="mt-1 text-sm font-semibold text-gray-800">{listing.area_m2 != null ? `${listing.area_m2}㎡` : "—"}</p>
                    <p className="text-xs text-gray-400">{t("dev.listing.spec_area")}</p>
                  </div>
                  <div>
                    <BedDouble className="w-4 h-4 mx-auto text-primary" />
                    <p className="mt-1 text-sm font-semibold text-gray-800">{listing.bedrooms ?? "—"}</p>
                    <p className="text-xs text-gray-400">{t("dev.listing.spec_bedrooms")}</p>
                  </div>
                  <div>
                    <Bath className="w-4 h-4 mx-auto text-primary" />
                    <p className="mt-1 text-sm font-semibold text-gray-800">{listing.bathrooms ?? "—"}</p>
                    <p className="text-xs text-gray-400">{t("dev.listing.spec_bathrooms")}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold text-[hsl(var(--brand-navy))]">{t("dev.listing.inquiry_title")}</h2>
                <p className="mt-1 text-sm text-gray-500">{t("dev.listing.inquiry_subtitle")}</p>
                <div className="mt-4">
                  <InquiryForm
                    submitLabelKey="dev.listing.inquiry_submit"
                    onSubmit={(v) => submitListingInquiry({
                      first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone,
                      message: v.message,
                      listing_id: String(listing.id),
                      listing_title: listing.title,
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DevLayout>
  );
}
