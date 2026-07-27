import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useGetPublicSpace, getGetPublicSpaceQueryKey, useListPublicSpaces } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { DateInput } from "@/components/ui/date-input";
import {
  MapPin, Star, ChevronLeft, ChevronRight,
  Camera, X, Check, MapPinned, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/footer";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";
import { isDevelopmentSite } from "@/lib/site-mode";
import { PRICE_UNIT_KEY } from "@/lib/priceUnit";
import { addWeeks, format, parseISO } from "date-fns";
import "leaflet/dist/leaflet.css";

// On single-building white-label instances (e.g. Metheim), the standard site's
// hardcoded "Melbourne" location fallbacks are wrong — suppress them in dev mode
// so nothing shows a foreign city. MillionStay (standard) is left untouched.
const DEV_SITE = isDevelopmentSite();

/* ─── Emoji-icon map ─── */
const optionEmojis: Record<string, string> = {
  "High-speed Wi-Fi": "📶", "High-speed WiFi": "📶",
  "Air-conditioning / Heating": "❄️", "Air Conditioning": "❄️",
  "Washing Machine": "🧺", "Refrigerator": "🧊",
  "Desk & Ergonomic Chair": "🪑", "Wardrobe / Built-in Closet": "👔",
  "Private Bathroom (Own Bath)": "🚿", "Shared Bathroom": "🚿",
  "Queen Bed": "🛏️", "Smart TV / TV in Room": "📺",
  "Microwave": "📦", "Electric Kettle": "☕",
  "No Smoking": "🚭", "Elevator (Lift)": "🛗",
  "Gym / Fitness Centre": "💪", "Swimming Pool": "🏊",
  "Parking": "🅿️", "Kitchen Access": "🍳", "Furnished": "🛋️",
};

/* ─── Photo Modal ─── */
function PhotoModal({
  images, initialIndex, onClose,
}: {
  images: Array<{ id?: number | string | null; file_url: string; thumbnail_url?: string | null; caption?: string | null }>;
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(images.length - 1, c + 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  useEffect(() => {
    const el = thumbRef.current?.querySelector(`[data-idx="${current}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [current]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" role="dialog">
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-white/80 hover:text-white text-sm">
          <X className="h-4 w-4" /> Close
        </button>
        <span className="text-white/70 text-sm">{current + 1} / {images.length}</span>
        <div className="w-16" />
      </div>
      <div className="flex-1 flex items-center justify-center relative px-16 min-h-0">
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
          className="absolute left-4 text-white/80 hover:text-white disabled:opacity-20 bg-white/10 hover:bg-white/20 rounded-full h-10 w-10 flex items-center justify-center">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <AnimatePresence mode="wait">
          <motion.img key={current} src={images[current]?.file_url} alt={images[current]?.caption ?? `Photo ${current + 1}`}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }} className="max-h-[75vh] max-w-full object-contain rounded-lg select-none" draggable={false} />
        </AnimatePresence>
        <button onClick={() => setCurrent((c) => Math.min(images.length - 1, c + 1))} disabled={current === images.length - 1}
          className="absolute right-4 text-white/80 hover:text-white disabled:opacity-20 bg-white/10 hover:bg-white/20 rounded-full h-10 w-10 flex items-center justify-center">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      {images[current]?.caption && (
        <p className="text-center text-white/60 text-sm pb-2">{images[current].caption}</p>
      )}
      <div ref={thumbRef} className="flex gap-2 overflow-x-auto px-6 py-3 justify-center shrink-0">
        {images.map((img, i) => (
          <button key={img.id ?? i} data-idx={i} onClick={() => setCurrent(i)}
            className={`flex-shrink-0 rounded transition-all ${i === current ? "ring-2 ring-primary opacity-100 scale-105" : "opacity-40 hover:opacity-70"}`}>
            <img src={img.thumbnail_url ?? img.file_url} alt="" className="w-16 h-12 object-cover rounded" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Photo Gallery (3-photo layout matching mockup) ─── */
function PhotoGallery({
  images, spaceName,
}: {
  images: Array<{ id?: number | string | null; file_url: string; thumbnail_url?: string | null; caption?: string | null }>;
  spaceName: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const open = (idx: number) => { setActiveIdx(idx); setModalOpen(true); };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCarouselIdx(Math.round(el.scrollLeft / el.offsetWidth));
  };

  if (images.length === 0) {
    return (
      <div className="h-56 md:h-72 rounded-xl bg-gradient-to-br from-primary to-brand-navy flex flex-col items-center justify-center gap-3">
        <span className="text-5xl">📸</span>
        <p className="text-white font-semibold">{spaceName}</p>
        <p className="text-white/70 text-sm">Photos coming soon</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile carousel */}
      <div className="md:hidden relative overflow-hidden rounded-xl">
        <div ref={scrollRef} onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth" style={{ scrollbarWidth: "none" }}>
          {images.map((img, i) => (
            <div key={img.id ?? i} className="flex-shrink-0 w-full snap-center h-56 cursor-pointer" onClick={() => open(i)}>
              <img src={img.file_url} alt={img.caption ?? spaceName} className="w-full h-full object-cover rounded-xl"
                loading={i === 0 ? "eager" : "lazy"} />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full bg-white transition-all duration-200 ${i === carouselIdx ? "w-4 opacity-100" : "w-1.5 opacity-50"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: main + 2 stacked thumbnails */}
      <div className="hidden md:grid grid-cols-3 gap-2 rounded-xl overflow-hidden h-[280px] relative">
        {/* Main image — 2/3 width */}
        <div className="col-span-2 overflow-hidden cursor-pointer" onClick={() => open(0)}>
          <img src={images[0]!.file_url} alt={spaceName}
            className="w-full h-full object-cover hover:brightness-95 transition-all duration-300" />
        </div>
        {/* 2 stacked thumbnails — 1/3 width */}
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            images[i] ? (
              <div key={images[i]!.id ?? i} className="flex-1 overflow-hidden cursor-pointer relative" onClick={() => open(i)}>
                <img src={images[i]!.thumbnail_url ?? images[i]!.file_url} alt={images[i]!.caption ?? `Photo ${i + 1}`}
                  className="w-full h-full object-cover hover:brightness-95 transition-all duration-300" loading="lazy" />
                {i === 2 && images.length > 3 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); open(2); }}>
                    <span className="text-white font-bold text-sm">+{images.length - 3} more</span>
                  </div>
                )}
              </div>
            ) : (
              <div key={i} className="flex-1 bg-gray-100" />
            )
          ))}
        </div>
        {/* Show all photos */}
        <button onClick={() => open(0)}
          className="absolute bottom-3 right-3 bg-white text-gray-800 px-3 py-1.5 rounded-lg shadow text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
          <Camera className="h-3.5 w-3.5" />
          All {images.length} photos
        </button>
      </div>

      {modalOpen && <PhotoModal images={images} initialIndex={activeIdx} onClose={() => setModalOpen(false)} />}
    </>
  );
}

/* ─── Mini map ─── */
function SpaceMiniMap({
  lat, lng, name, address, blurred = false,
}: {
  lat: number; lng: number; name: string; address?: string; blurred?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    let map: import("leaflet").Map | null = null;
    import("leaflet").then((L) => {
      if (!containerRef.current) return;
      map = L.map(containerRef.current, { center: [lat, lng], zoom: 14, scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      // Resolve the instance primary token to a concrete color: Leaflet writes
      // path colors as SVG attributes, which don't evaluate CSS var().
      const brandColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue("--brand-orange").trim() || "21 82% 51%"})`;
      if (blurred) {
        // Show approximate area circle instead of exact pin
        L.circle([lat, lng], {
          radius: 200,
          color: brandColor,
          fillColor: brandColor,
          fillOpacity: 0.12,
          weight: 2,
          opacity: 0.6,
        }).addTo(map);
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${brandColor};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);opacity:0.7"></div>`,
          iconAnchor: [10, 10],
        });
        L.marker([lat, lng], { icon }).addTo(map)
          .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px"><strong>${name}</strong><br/><span style="color:#888;font-size:11px">Approximate location</span></div>`);
      } else {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${brandColor};width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
          iconAnchor: [7, 7],
        });
        L.marker([lat, lng], { icon }).addTo(map)
          .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px"><strong>${name}</strong>${address ? `<br/><span style="color:#666">${address}</span>` : ""}</div>`)
          .openPopup();
      }
    });
    return () => { map?.remove(); };
  }, [lat, lng, name, address, blurred]);
  return <div ref={containerRef} className="w-full h-full" />;
}

/* ─── Related space card ─── */
function RelatedCard({ space }: { space: Record<string, unknown> }) {
  const [, setLocation] = useLocation();
  const { formatDisplayPrice } = useDisplayCurrency();
  const img = (space.primary_thumbnail as string | null)
    ?? `https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&q=75`;
  return (
    <div onClick={() => setLocation(`/spaces/${space.id}`)}
      className="bg-white rounded-xl overflow-hidden border cursor-pointer hover:shadow-md transition-shadow">
      <div className="relative h-36 overflow-hidden">
        <img src={img} alt={space.name as string} className="w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <p className="text-white text-xs font-semibold truncate">{space.room_type as string ?? "Private Room"} · Queen Bed</p>
          <p className="text-white/80 text-xs">{(space.suburb as string) ?? (DEV_SITE ? "" : "Melbourne")} · {space.property_type as string ?? "Apartment"}</p>
        </div>
        <div className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded">
          {(space.room_type as string ?? "Room")}
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-3 w-3 ${i < 4 ? "fill-primary text-primary" : "text-gray-200"}`} />
          ))}
        </div>
        <p className="text-primary font-bold text-sm">{formatDisplayPrice(Number(space.price_per_week ?? 440), ((space.base_currency as string) || "AUD").toUpperCase()).primary}<span className="text-gray-400 font-normal text-xs">/wk</span></p>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export default function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);

  // Read dates from URL search params (passed from home/search pages)
  const urlParams = new URLSearchParams(window.location.search);
  const [checkIn, setCheckIn] = useState<string>(urlParams.get("check_in") ?? "");
  const [checkOut, setCheckOut] = useState<string>(urlParams.get("check_out") ?? "");

  const spaceId = parseInt(id ?? "0", 10);

  const { data: spaceData, isLoading } = useGetPublicSpace(spaceId, {
    query: { enabled: !!spaceId, queryKey: getGetPublicSpaceQueryKey(spaceId) },
  });
  const { data: allSpaces } = useListPublicSpaces(undefined, {
    query: { queryKey: ["related-spaces", spaceId] },
  });

  const space = spaceData?.data;

  // Auto-select the first product (or "best_value" tagged) when space data loads
  useEffect(() => {
    if (space?.products && space.products.length > 0 && selectedProduct === null) {
      const bestValue = space.products.find((p) => p.product_tag === "best_value");
      const autoSelect = bestValue ?? space.products[0];
      setSelectedProduct(autoSelect.id);
    }
  }, [space?.products, selectedProduct]);

  const relatedSpaces = useMemo(() => {
    const list = (allSpaces?.data ?? []) as unknown as Record<string, unknown>[];
    return list.filter((s) => s.id !== spaceId).slice(0, 3);
  }, [allSpaces, spaceId]);

  const handleCheckInChange = useCallback((date: string) => {
    setCheckIn(date);
    if (!date || !space) { setCheckOut(""); return; }
    try {
      const product = space.products?.find((p) => p.id === selectedProduct);
      const weeks = product?.min_contract_period ?? space.min_stay_weeks ?? 4;
      const parsed = parseISO(date);
      if (isNaN(parsed.getTime())) { setCheckOut(""); return; }
      setCheckOut(format(addWeeks(parsed, weeks), "yyyy-MM-dd"));
    } catch { setCheckOut(""); }
  }, [space, selectedProduct]);

  const stayDays = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const d = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000));
    return d > 0 ? d : null;
  }, [checkIn, checkOut]);

  const stayWeeks = stayDays ? stayDays / 7 : null;

  const selectedPriceProduct = space?.products?.find((p) => p.id === selectedProduct);
  const weeklyRate = Number(selectedPriceProduct?.price ?? space?.base_weekly_price ?? 0);
  const priceCurrency: string = (space?.base_currency || selectedPriceProduct?.currency || "AUD").toString().toUpperCase();
  const { formatDisplayPrice, forceDisplayCurrency } = useDisplayCurrency();
  const weeklyRateDisplay = formatDisplayPrice(Number(weeklyRate), priceCurrency);
  const weeklyRateRef = Number(weeklyRate) > 0 ? weeklyRateDisplay.reference : null;
  // Format any amount in the listing's currency, honouring the instance's
  // single-currency pin (e.g. Metheim → ₩, converted from the AUD base).
  const money = (n: number) => formatDisplayPrice(Number(n) || 0, priceCurrency).primary;
  // Pro-rata: weekly_rate / 7 × days
  const rentTotal = stayDays && weeklyRate ? Math.round((weeklyRate / 7) * stayDays * 100) / 100 : null;

  // Fees come from the selected product (null = not charged for this product)
  const productBond = selectedPriceProduct?.bond_amount ?? null;
  const productAdminFee = selectedPriceProduct?.admin_fee ?? null;
  const productCleaningFee = selectedPriceProduct?.cleaning_fee ?? null;

  // Bond: use product bond_amount if set, otherwise 4 weeks × weekly rate
  const deposit = productBond != null ? productBond : weeklyRate * 4;
  const adminFee = productAdminFee ?? 0;
  const cleaningFee = productCleaningFee ?? 0;
  // Initial payment includes 2 weeks advance rent (consistent with booking wizard)
  const initialRent = weeklyRate * 2;
  const totalToday = deposit + adminFee + cleaningFee + initialRent;

  const handleEnquire = () => {
    if (!space) return;
    const params = new URLSearchParams();
    if (selectedProduct) params.set("product_id", String(selectedProduct));
    if (checkIn) params.set("check_in", checkIn);
    if (checkOut) params.set("check_out", checkOut);
    params.set("space_id", String(space.id));

    /* Determine stay type — long-term (≥ 4 weeks) can proceed without login */
    const stayWeeks = (checkIn && checkOut)
      ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    const isLong = stayWeeks >= 4;

    if (!token && !isLong) {
      setLocation(`/login?redirect=${encodeURIComponent(`/booking/new?${params.toString()}`)}`);
      return;
    }
    setLocation(`/booking/new?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {DEV_SITE ? <DevNavbar /> : <Navbar />}
        <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6">
          <Skeleton className="h-[280px] w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-4">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen flex flex-col">
        {DEV_SITE ? <DevNavbar /> : <Navbar />}
        <div className="max-w-6xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-bold">Space not found</h1>
          <Button onClick={() => setLocation("/search")} className="mt-4">Browse spaces</Button>
        </div>
      </div>
    );
  }

  const images = (space.images ?? []) as Array<{ id?: number | string | null; file_url: string; thumbnail_url?: string | null; caption?: string | null }>;
  const addressParts = [space.property_address, space.suburb_name, space.property_state].filter(Boolean);
  const addressStr = addressParts.join(", ") + (space.property_postcode ? ` ${space.property_postcode}` : "");
  const amenities = (space.options ?? []) as Array<{ id: number | string; name: string }>;
  // Lease price options (보증금 → 월세 tiers + 프로모션) — Metheim rate-card table.
  const rentOptions = ((space as any).rent_options ?? []) as Array<{
    id: number; deposit_amount: number; monthly_rent: number;
    promo_monthly_rent: number | null; currency: string; is_default: boolean;
  }>;
  const fmtOpt = (n: number, cur?: string) =>
    formatDisplayPrice(Number(n) || 0, (cur || priceCurrency).toUpperCase()).primary;
  const lat = Number(space.latitude);
  const lng = Number(space.longitude);
  const isMapBlurred = space.privacy_map_blur === true;
  const hasMap = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}

      {/* Banner — theme-driven hero gradient (Metheim: deep-teal → urban-teal
          "night harbor"; standard: deep-navy → brand orange). */}
      <div className="h-20 flex items-center px-6" style={{ background: "linear-gradient(135deg, hsl(var(--brand-navy)) 0%, hsl(var(--primary)) 100%)" }}>
        <div className="max-w-6xl mx-auto w-full flex items-center gap-2">
          <button onClick={() => setLocation("/search")} className="text-white/70 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="font-cursive text-white/70 text-xs italic">Room Details</p>
            <h1 className="text-white text-xl font-bold italic">Booking</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-6">
        {/* Photo Gallery */}
        <div className="mb-6">
          <PhotoGallery images={images} spaceName={space.name} />
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left column ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Price + distance */}
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-3xl font-bold text-primary">{weeklyRateDisplay.primary}</span>
                <span className="text-sm text-gray-500 ml-1">/Per Week</span>
                {weeklyRateRef && (
                  <div className="text-xs text-muted-foreground mt-0.5">{weeklyRateRef}</div>
                )}
                {forceDisplayCurrency && (
                  <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">{t("space.fx_payment_note")}</p>
                )}
              </div>
              {addressParts.length > 0 && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  {DEV_SITE ? (space.suburb_name ?? "") : `${space.suburb_name ?? ""}, Melbourne`}
                </p>
              )}
            </div>

            {/* Title + badges */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{space.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="bg-primary/5 text-primary text-xs font-semibold px-3 py-1 rounded-full border border-primary/30">
                  📅 {space.min_stay_weeks ?? 4} Weeks min.
                </span>
                {space.max_occupancy && (
                  <span className="bg-primary/5 text-primary text-xs font-semibold px-3 py-1 rounded-full border border-primary/30">
                    👤 {space.max_occupancy} Guest{space.max_occupancy > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Description */}
            {space.description && (
              <div>
                <p className="text-gray-600 leading-relaxed text-sm">{space.description}</p>
              </div>
            )}

            {/* Key Features */}
            {amenities.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-base font-bold text-gray-800 mb-4">Key Features</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {amenities.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span>{optionEmojis[opt.name] ? `${optionEmojis[opt.name]} ` : ""}{opt.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Rent Plans — 보증금별 월세 옵션 (임대료 rate card) */}
            {rentOptions.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-base font-bold text-gray-800 mb-1">{t("space.rent.plans_title")}</h2>
                  <p className="text-xs text-gray-500 mb-4">{t("space.rent.plans_subtitle")}</p>
                  <div className="overflow-x-auto rounded-xl border bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <th className="text-left font-semibold px-4 py-2.5">{t("space.rent.deposit")}</th>
                          <th className="text-right font-semibold px-4 py-2.5">{t("space.rent.monthly")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentOptions.map((o) => {
                          const hasPromo = o.promo_monthly_rent != null && o.promo_monthly_rent < o.monthly_rent;
                          return (
                            <tr key={o.id} className="border-t border-gray-100">
                              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                                {fmtOpt(o.deposit_amount, o.currency)}
                                {o.is_default && (
                                  <span className="ml-2 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded align-middle">
                                    {t("space.rent.base")}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {hasPromo ? (
                                  <span className="inline-flex items-center gap-2 justify-end flex-wrap">
                                    <span className="text-gray-400 line-through">{fmtOpt(o.monthly_rent, o.currency)}</span>
                                    <span className="font-bold text-primary">
                                      {fmtOpt(o.promo_monthly_rent!, o.currency)}
                                      <span className="text-xs font-normal text-gray-400 ml-0.5">{t(PRICE_UNIT_KEY)}</span>
                                    </span>
                                    <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                      {t("space.rent.promo")}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="font-semibold text-gray-800">
                                    {fmtOpt(o.monthly_rent, o.currency)}
                                    <span className="text-xs font-normal text-gray-400 ml-0.5">{t(PRICE_UNIT_KEY)}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {forceDisplayCurrency && (
                    <p className="mt-2 text-xs text-gray-400 leading-relaxed">{t("space.fx_payment_note")}</p>
                  )}
                </div>
              </>
            )}

            {/* Stay Plans */}
            {space.products && space.products.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-base font-bold text-gray-800 mb-4">Stay Plans</h2>
                  <div className="space-y-2">
                    {space.products.map((p) => {
                      const baseRate = Number(space.base_weekly_price ?? 0);
                      const saving = baseRate > (p.price ?? 0) ? baseRate - (p.price ?? 0) : null;
                      return (
                        <button key={p.id} onClick={() => { setSelectedProduct(p.id); handleCheckInChange(checkIn); }}
                          className={`w-full rounded-xl border p-4 text-left text-sm transition-all ${
                            selectedProduct === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-gray-200 bg-white hover:border-primary/40"
                          }`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-800">{p.name}</span>
                              {p.product_tag === "best_value" && (
                                <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded">Best Value</span>
                              )}
                              {saving && saving > 0 && (
                                <span className="text-xs bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">Save {formatDisplayPrice(saving, priceCurrency).primary}/wk</span>
                              )}
                            </div>
                            <span className="font-bold text-primary text-base">{formatDisplayPrice(Number(p.price ?? 0), priceCurrency).primary}<span className="text-xs font-normal text-gray-400">/wk</span></span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Fee breakdown */}
            <Separator />
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-3">Fee Breakdown</h2>
              <div className="rounded-xl border bg-white p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Weekly rent</span>
                  <span className="font-semibold">{money(weeklyRate)}</span>
                </div>
                {productAdminFee != null && productAdminFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Admission Fee (one-time)</span>
                    <span>{money(productAdminFee)}</span>
                  </div>
                )}
                {productCleaningFee != null && productCleaningFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cleaning Fee (one-time)</span>
                    <span>{money(productCleaningFee)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Security Bond</span>
                  <span>{productBond != null ? money(productBond) : `${money(weeklyRate * 4)} (4 wk)`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Initial Rent (2 wk)</span>
                  <span>{money(weeklyRate * 2)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Right column (sticky booking card) ── */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="sticky top-24 space-y-4">

              {/* Booking section card */}
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-primary px-5 py-3">
                  <p className="text-white font-semibold text-sm tracking-wide">Booking Section</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-2xl font-bold text-gray-900">{money(weeklyRate)}</span>
                      <span className="text-sm text-gray-500 mb-0.5">/week</span>
                    </div>
                    <div className="flex items-center gap-1 mb-3">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium">5.0</span>
                      <span className="text-xs text-gray-400">· {space.suburb_name ?? (DEV_SITE ? "" : "Melbourne")}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Secure your room today with a simple deposit. Our team will contact you within 24 hours to confirm availability and guide you through the move-in process.
                    </p>
                  </div>

                  {/* Date inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Check In</label>
                      <DateInput value={checkIn} onChange={(v) => handleCheckInChange(v)}
                        min={format(new Date(), "yyyy-MM-dd")}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Check Out</label>
                      <DateInput value={checkOut} onChange={setCheckOut}
                        min={checkIn || format(new Date(), "yyyy-MM-dd")}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-primary/30" />
                    </div>
                  </div>

                  {/* Fee summary when dates picked */}
                  {stayDays && stayDays > 0 && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-400">
                        <span>{money(weeklyRate)}/wk ÷ 7 × {stayDays} days</span>
                        <span>{money(Number(rentTotal ?? 0))}</span>
                      </div>
                      <div className="border-t border-primary/30 pt-1.5 space-y-1">
                        <p className="text-gray-400 font-medium">Initial payment (once-off):</p>
                        <div className="flex justify-between text-gray-500">
                          <span>Security Bond{productBond == null ? " (4 wk)" : " (refundable)"}</span>
                          <span>{money(deposit)}</span>
                        </div>
                        {adminFee > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>Admin Fee</span>
                            <span>{money(adminFee)}</span>
                          </div>
                        )}
                        {cleaningFee > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>Cleaning Fee</span>
                            <span>{money(cleaningFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-500">
                          <span>Initial Rent (2 wk)</span>
                          <span>{money(initialRent)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-800 border-t border-primary/30 pt-1">
                          <span>Est. Due Today</span>
                          <span className="text-primary">{money(totalToday)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <Button onClick={handleEnquire}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl py-5 gap-2">
                    <FileText className="h-4 w-4" />
                    APPLY / ENQUIRE FORM
                  </Button>

                  <Separator />

                  {/* Map */}
                  {hasMap ? (
                    <div>
                      <div className="h-44 rounded-xl overflow-hidden border border-gray-200 mb-3">
                        <SpaceMiniMap lat={lat} lng={lng} name={space.name} address={addressStr} blurred={isMapBlurred} />
                      </div>
                      {isMapBlurred ? (
                        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Approximate location shown for privacy
                        </p>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10 gap-2 rounded-xl">
                            <MapPinned className="h-4 w-4" />
                            VIEW LOCATION
                          </Button>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="h-44 rounded-xl overflow-hidden border border-gray-200 mb-3 bg-gray-100 flex items-center justify-center">
                        <div className="text-center text-gray-400">
                          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs">{addressStr || (DEV_SITE ? "" : "Melbourne, VIC")}</p>
                        </div>
                      </div>
                      <Button variant="outline" disabled className="w-full border-gray-300 text-gray-400 gap-2 rounded-xl">
                        <MapPinned className="h-4 w-4" />
                        VIEW LOCATION
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Choose Your Room ── */}
        {relatedSpaces.length > 0 && (
          <div className="mt-12">
            <div className="text-center mb-6">
              <p className="font-cursive text-primary text-xl italic">Choose Your Room</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedSpaces.map((s) => <RelatedCard key={s.id as number} space={s} />)}
            </div>
          </div>
        )}
      </div>

      {DEV_SITE ? <DevFooter /> : <Footer />}
    </div>
  );
}
