import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { MapPin, Maximize, BedDouble, Bath, ImageOff } from "lucide-react";
import type { SaleListing } from "@/lib/development-api";

// Shared 분양/판매 listing card used by the /buy preview and the /buy/list board.

const CATEGORY_BADGE: Record<string, string> = {
  presale: "bg-primary/10 text-primary",
  sale: "bg-emerald-500/10 text-emerald-700",
};
const STATUS_BADGE: Record<string, string> = {
  available: "bg-green-500/10 text-green-700",
  reserved: "bg-amber-500/10 text-amber-700",
  sold: "bg-gray-200 text-gray-500",
};

export function ListingCard({ listing }: { listing: SaleListing }) {
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
