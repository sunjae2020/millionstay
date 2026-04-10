import { useTranslation } from "react-i18next";
import heroImage from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { useLocation } from "wouter";
import { useState } from "react";
import { useListSuburbs } from "@workspace/api-client-react";
import { useListFeaturedSpaces, useListPublicSpaces } from "@/lib/guest-api";
import { motion } from "framer-motion";
import { Wifi, ShoppingBag, Shield, DollarSign, Plane, Bed, PlayCircle, MapPin, ChevronRight } from "lucide-react";
function SectionTitle({ italic, normal, sub }: { italic: string; normal?: string; sub?: string }) {
  return (
    <div className="text-center mb-10">
      <p className="text-gray-400 text-sm mb-1">{sub}</p>
      <h2 className="text-3xl md:text-4xl" style={{ fontFamily: "'Dancing Script', cursive", color: "#e07020" }}>
        {italic}
        {normal && <span className="text-gray-700" style={{ fontFamily: "Inter, sans-serif", fontSize: "1.6rem", fontWeight: 700, marginLeft: 8 }}>{normal}</span>}
      </h2>
    </div>
  );
}

function buildSpaceUrl(id: number | string, checkIn: string, checkOut: string) {
  const p = new URLSearchParams();
  if (checkIn) p.set("check_in", checkIn);
  if (checkOut) p.set("check_out", checkOut);
  const qs = p.toString();
  return `/spaces/${id}${qs ? `?${qs}` : ""}`;
}

const SPACE_FEATURES: Record<string, { icon: string; label: string }[]> = {
  EntireSpace: [
    { icon: "🏠", label: "Entire unit" },
    { icon: "🔑", label: "Private entry" },
    { icon: "📶", label: "Free Wi-Fi" },
  ],
  RoomSpace: [
    { icon: "🛏", label: "Private room" },
    { icon: "🚿", label: "Shared bathroom" },
    { icon: "📶", label: "Free Wi-Fi" },
  ],
  BedSpace: [
    { icon: "🛏", label: "Shared room" },
    { icon: "💰", label: "Best value" },
    { icon: "📶", label: "Free Wi-Fi" },
  ],
};

function ListingCard({ space, index = 0, checkIn = "", checkOut = "" }: { space: any; index?: number; checkIn?: string; checkOut?: string }) {
  const [, setLocation] = useLocation();
  const features = SPACE_FEATURES[space.space_type] ?? SPACE_FEATURES.RoomSpace;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => setLocation(buildSpaceUrl(space.id, checkIn, checkOut))}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-orange-50">
        {space.primary_image ? (
          <img src={space.primary_image} alt={space.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
            <Bed className="h-10 w-10 text-primary/40" />
          </div>
        )}
        <div className="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2 py-1 rounded">
          {space.space_type === "EntireSpace" ? "Entire" : space.space_type === "RoomSpace" ? "Room" : "Bed"}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 text-sm leading-snug mb-1 line-clamp-1">{space.name}</h3>
        {space.suburb_name && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-2.5">
            <MapPin className="h-3 w-3" /> {space.suburb_name}
          </p>
        )}
        {/* 특장점 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {features.map((f) => (
            <span key={f.label} className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
              {f.icon} {f.label}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-primary">${space.base_weekly_price}</span>
            <span className="text-xs text-gray-400 ml-1">/ week</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(buildSpaceUrl(space.id, checkIn, checkOut)); }}
            className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const amenities = [
  { icon: Wifi, label: "High-Speed Wi-Fi" },
  { icon: ShoppingBag, label: "Flexible Stay Options" },
  { icon: Bed, label: "Fully Furnished Rooms" },
  { icon: Shield, label: "Safe & Secure Listing" },
  { icon: DollarSign, label: "All-Inclusive Pricing" },
  { icon: Plane, label: "Optional Airport Pickup" },
];

const whyChooseUs = [
  {
    num: "01",
    title: "Testimonials Network",
    desc: "Thousands of happy students and nomads have found their perfect Melbourne home through our verified listings and trusted community."
  },
  {
    num: "02",
    title: "Student & Multi-Sport Focus",
    desc: "We understand the needs of international students — from university proximity to flexible leases that match your enrollment period."
  },
  {
    num: "03",
    title: "All-Inclusive Comfort",
    desc: "Utilities, Wi-Fi, cleaning, and furnishings are all included. Move in with just your luggage — we handle everything else."
  },
];

export default function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: suburbsData } = useListSuburbs();

  const [suburbId, setSuburbId] = useState<string>("");
  const [spaceType, setSpaceType] = useState<string>("");
  const [guests, setGuests] = useState<string>("1");
  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");

  const { data: featuredData, isLoading: loadingFeatured } = useListFeaturedSpaces();
  const { data: spacesData } = useListPublicSpaces({ limit: 8, offset: 0 });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (suburbId && suburbId !== "all") params.append("suburb_id", suburbId);
    if (spaceType && spaceType !== "all") params.append("space_type", spaceType);
    if (checkIn) params.append("check_in", checkIn);
    if (checkOut) params.append("check_out", checkOut);
    setLocation(`/search?${params.toString()}`);
  };

  const featured = featuredData?.data ?? [];
  const allSpaces = spacesData?.data ?? [];
  const spotlightSpace = featured[0] ?? allSpaces[0];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative">
        {/* Background */}
        <div className="relative h-[460px] md:h-[540px] overflow-hidden">
          <img
            src={heroImage}
            alt="MillionStay Melbourne"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />

          {/* Overlay text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-white/90 text-lg md:text-xl mb-2"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Million Homestay Australia
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-white font-bold text-6xl md:text-8xl tracking-wide uppercase drop-shadow-lg"
            >
              WELCOME
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/80 text-sm md:text-base mt-4 max-w-md"
            >
              Your trusted home away from home in Melbourne, Australia
            </motion.p>
          </div>
        </div>

        {/* Search Card — floats out of hero */}
        <div className="max-w-5xl mx-auto px-4 -mt-16 relative z-10">
          <div className="bg-white rounded-lg shadow-xl p-4 md:p-6">
            <form onSubmit={handleSearch}>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Space Type</label>
                  <Select value={spaceType} onValueChange={setSpaceType}>
                    <SelectTrigger className="h-10 text-sm" data-testid="search-type">
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any type</SelectItem>
                      <SelectItem value="EntireSpace">{t("space.entire")}</SelectItem>
                      <SelectItem value="RoomSpace">{t("space.room")}</SelectItem>
                      <SelectItem value="BedSpace">{t("space.bed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Search</label>
                  <Select value={suburbId} onValueChange={setSuburbId}>
                    <SelectTrigger className="h-10 text-sm" data-testid="search-suburb">
                      <SelectValue placeholder="Any suburb" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any suburb</SelectItem>
                      {suburbsData?.data?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Check In</label>
                  <DateInput
                    value={checkIn}
                    onChange={setCheckIn}
                    min={new Date().toISOString().slice(0, 10)}
                    className="h-10 border border-input rounded-md px-3 text-sm text-gray-700"
                    data-testid="search-date"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Check Out</label>
                  <DateInput
                    value={checkOut}
                    onChange={setCheckOut}
                    min={checkIn || new Date().toISOString().slice(0, 10)}
                    className="h-10 border border-input rounded-md px-3 text-sm text-gray-700"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full h-10 bg-primary hover:bg-primary/90 text-white font-bold text-sm uppercase tracking-wider rounded transition-colors"
                    data-testid="button-search"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="pt-24 pb-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle italic="Why Choose Us" sub="OUR ADVANTAGES" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {whyChooseUs.map((item) => (
              <motion.div
                key={item.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center p-6"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">{item.num}</span>
                </div>
                <h3 className="font-bold text-gray-800 text-base mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Spotlight Featured Listing ── */}
      {spotlightSpace && (
        <section className="py-8 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl overflow-hidden bg-white shadow-lg grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <div className="inline-block bg-primary text-white text-2xl font-bold px-4 py-2 rounded mb-4 w-fit">
                  ${spotlightSpace.base_weekly_price}
                  <span className="text-xs font-normal ml-1">/ Per Week</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{spotlightSpace.name}</h2>
                {spotlightSpace.suburb_name && (
                  <p className="text-sm text-gray-400 flex items-center gap-1 mb-4">
                    <MapPin className="h-3.5 w-3.5" /> {spotlightSpace.suburb_name}, Melbourne
                  </p>
                )}
                <p className="text-sm text-gray-500 leading-relaxed mb-6">
                  Fully furnished private room in a shared house. Weekly rate is all-inclusive — WiFi, utilities, and cleaning included.
                </p>
                <button
                  onClick={() => setLocation(buildSpaceUrl(spotlightSpace.id, checkIn, checkOut))}
                  className="w-fit px-6 py-3 bg-primary text-white font-bold text-sm uppercase tracking-wide rounded hover:bg-primary/90 transition-colors"
                >
                  Book Now
                </button>
              </div>
              <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[300px] overflow-hidden">
                {spotlightSpace.primary_image ? (
                  <img src={spotlightSpace.primary_image} alt={spotlightSpace.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                    <Bed className="h-16 w-16 text-primary/30" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Million Homestay Listing ── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle italic="Million Homestay Listing" sub="AVAILABLE NOW" />
          {loadingFeatured ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden shadow animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                    <div className="h-5 w-1/3 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 4 × 2 그리드 (8개) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {(() => {
                  const combined = [
                    ...featured,
                    ...allSpaces.filter((s) => !featured.some((f) => f.id === s.id)),
                  ].slice(0, 8);
                  return combined.map((space, i) => (
                    <ListingCard key={space.id} space={space} index={i} checkIn={checkIn} checkOut={checkOut} />
                  ));
                })()}
              </div>
            </>
          )}
          <div className="text-center mt-10">
            <button
              onClick={() => setLocation("/search")}
              className="px-8 py-3 bg-primary text-white font-bold text-sm uppercase tracking-wider rounded hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              View All Listings <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Choose Your Stay Plan ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle italic="Choose Your Stay Plan" sub="FLEXIBLE OPTIONS" />
          <p className="text-center text-sm text-gray-400 -mt-6 mb-10">The longer you stay, the more you save — select a plan that fits your timeline.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                period: "1-Month",
                label: "Flexible Contract",
                highlight: false,
                desc: "Ideal for short trips or trial stays. Full flexibility with a 2-week notice period.",
                features: [
                  "2-week cancellation notice",
                  "Month-to-month renewal",
                  "All utilities included",
                  "Fully furnished room",
                  "Shared common areas",
                  "Move in anytime",
                ],
                savings: null,
              },
              {
                period: "3-Month",
                label: "Better Value",
                highlight: true,
                desc: "Our most popular option for semester students. Save 5% vs monthly rate.",
                features: [
                  "5% discount on weekly rate",
                  "Priority room selection",
                  "All utilities included",
                  "Fully furnished room",
                  "Dedicated study space",
                  "Free airport pickup",
                ],
                savings: "Save 5%",
              },
              {
                period: "6-Month",
                label: "Best Deal",
                highlight: false,
                desc: "Maximum savings for long-term residents. Save 10% and lock in your preferred room.",
                features: [
                  "10% discount on weekly rate",
                  "Guaranteed room lock-in",
                  "All utilities included",
                  "Fully furnished room",
                  "Free airport pickup",
                  "Complimentary cleaning",
                ],
                savings: "Save 10%",
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.period}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-lg overflow-hidden border-2 flex flex-col ${plan.highlight ? "border-primary shadow-xl scale-[1.02]" : "border-gray-200 shadow"}`}
              >
                {/* Header */}
                <div className={`py-6 px-6 ${plan.highlight ? "bg-primary text-white" : "bg-gray-700 text-white"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">{plan.label}</p>
                      <h3 className="text-3xl font-bold">{plan.period}</h3>
                      <p className="text-sm opacity-80 mt-0.5">Stay</p>
                    </div>
                    {plan.savings && (
                      <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">
                        {plan.savings}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 bg-white flex flex-col flex-1">
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">{plan.desc}</p>

                  {/* Feature list */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${plan.highlight ? "bg-primary" : "bg-gray-600"}`}>
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setLocation("/search")}
                    className={`w-full py-3 text-sm font-bold uppercase tracking-wide rounded transition-colors ${
                      plan.highlight
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-gray-700 text-white hover:bg-gray-600"
                    }`}
                  >
                    Book Now
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Orange Video CTA ── */}
      <section
        className="py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #c05010 0%, #e07828 50%, #c86820 100%)" }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
        <div className="relative z-10 text-center px-4">
          <p
            className="text-white/90 text-2xl md:text-3xl mb-2"
            style={{ fontFamily: "'Dancing Script', cursive" }}
          >
            Million Homestay Australia...
          </p>
          <h2 className="text-white font-bold text-4xl md:text-5xl uppercase tracking-widest mb-8">
            YOUR BEST CHOICE
          </h2>
          <button className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mx-auto hover:bg-white/30 transition-colors group">
            <PlayCircle className="h-10 w-10 text-white group-hover:scale-105 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── What's Included ── */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle italic="What's Included in Your Stay" sub="ALL-INCLUSIVE" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {amenities.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex flex-col items-center text-center gap-3 p-4"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-gray-600 leading-tight">{item.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
