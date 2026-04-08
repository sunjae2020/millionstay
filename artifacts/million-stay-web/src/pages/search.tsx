import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useListSuburbs } from "@workspace/api-client-react";
import { useListPublicSpaces, getListPublicSpacesQueryKey } from "@/lib/guest-api";
import { Navbar } from "@/components/navbar";
import { SpaceCard } from "@/components/space-card";
import { Footer } from "@/components/footer";
import { SpaceMap } from "@/components/space-map";
import { Slider } from "@/components/ui/slider";
import {
  MapPin, X, ChevronDown, Map as MapIcon, Search as SearchIcon,
  Home, Building2, BedDouble, ChevronRight, Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const PAGE_SIZE = 20;
type DropdownKey = "suburb" | "type" | "price" | "gender" | "dates" | null;

const SPACE_TYPES = [
  { value: "all", label: "Any Type", icon: Home },
  { value: "EntireSpace", label: "Entire Space", icon: Building2 },
  { value: "RoomSpace", label: "Private Room", icon: BedDouble },
  { value: "BedSpace", label: "Shared Room", icon: BedDouble },
];

export default function Search() {
  const { t } = useTranslation();
  const [location] = useLocation();

  const getUrlParams = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      suburb_id: p.get("suburb_id") ?? "",
      space_type: p.get("space_type") ?? "all",
      gender_policy: p.get("gender_policy") ?? "all",
      min_price: Number(p.get("min_price") ?? 100),
      max_price: Number(p.get("max_price") ?? 1200),
      check_in: p.get("check_in") ?? "",
      check_out: p.get("check_out") ?? "",
    };
  };

  const init = getUrlParams();
  const [suburbId, setSuburbId] = useState(init.suburb_id);
  const [spaceType, setSpaceType] = useState(init.space_type);
  const [genderPolicy, setGenderPolicy] = useState(init.gender_policy);
  const [priceRange, setPriceRange] = useState<[number, number]>([init.min_price, init.max_price]);
  const [checkIn, setCheckIn] = useState(init.check_in);
  const [checkOut, setCheckOut] = useState(init.check_out);
  const [offset, setOffset] = useState(0);
  const [allSpaces, setAllSpaces] = useState<Record<string, unknown>[]>([]);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [showMap, setShowMap] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | string | null>(null);

  const { data: suburbsData } = useListSuburbs();
  const suburbs = suburbsData?.data ?? [];

  const queryParams = {
    suburb_id: suburbId ? parseInt(suburbId) : undefined,
    space_type: spaceType !== "all" ? (spaceType as "EntireSpace" | "RoomSpace" | "BedSpace") : undefined,
    gender_policy: genderPolicy !== "all" ? (genderPolicy as "FemaleOnly" | "Mixed") : undefined,
    min_price: priceRange[0] > 100 ? priceRange[0] : undefined,
    max_price: priceRange[1] < 1200 ? priceRange[1] : undefined,
    start_date: checkIn || undefined,
    end_date: checkOut || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data: spacesData, isLoading } = useListPublicSpaces(queryParams, {
    query: { queryKey: getListPublicSpacesQueryKey(queryParams) },
  });

  const total = (spacesData?.meta as Record<string, unknown>)?.total as number ?? 0;

  useEffect(() => {
    const spaces = (spacesData?.data ?? []) as Record<string, unknown>[];
    if (offset === 0) {
      setAllSpaces(spaces);
    } else {
      setAllSpaces((prev) => {
        const ids = new Set(prev.map((s) => s.id));
        return [...prev, ...spaces.filter((s) => !ids.has(s.id))];
      });
    }
  }, [spacesData, offset]);

  const resetOffset = () => setOffset(0);

  const clearFilters = () => {
    setSuburbId(""); setSpaceType("all"); setGenderPolicy("all");
    setPriceRange([100, 1200]); setCheckIn(""); setCheckOut("");
    resetOffset(); setOpenDropdown(null);
  };

  const hasActiveFilters = suburbId !== "" || spaceType !== "all" || genderPolicy !== "all" || priceRange[0] > 100 || priceRange[1] < 1200 || !!checkIn;
  const activeCount = [suburbId !== "", spaceType !== "all", genderPolicy !== "all", priceRange[0] > 100 || priceRange[1] < 1200, !!checkIn].filter(Boolean).length;

  const formatDateLabel = (d: string) => d ? new Date(d + "T00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "";
  const datesLabel = checkIn ? `${formatDateLabel(checkIn)}${checkOut ? ` → ${formatDateLabel(checkOut)}` : ""}` : "Dates";
  const suburbName = suburbs.find((s) => String(s.id) === suburbId)?.name ?? null;

  const toggleDropdown = (key: DropdownKey) => setOpenDropdown((prev) => (prev === key ? null : key));

  const handleMarkerClick = useCallback((id: number | string) => {
    const el = document.getElementById(`space-card-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHoveredId(id);
    setTimeout(() => setHoveredId(null), 2000);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="relative h-52 md:h-60 overflow-hidden shrink-0">
        <img src={heroBg} alt="Location" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/80 text-lg italic mb-1">Find Your Perfect</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">Location</h1>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">Location</span>
      </div>

      {/* ── Sticky Filter Bar ── */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-2 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>

            {/* Suburb */}
            <div className="relative shrink-0">
              <button onClick={() => toggleDropdown("suburb")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  suburbId ? "bg-primary border-primary text-white shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                }`}>
                <MapPin className="h-3.5 w-3.5" />
                {suburbName ?? "Location"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              <AnimatePresence>
                {openDropdown === "suburb" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl border shadow-xl z-50 py-2 max-h-64 overflow-y-auto">
                    <button onClick={() => { setSuburbId(""); resetOffset(); setOpenDropdown(null); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-2 ${!suburbId ? "text-primary font-semibold" : "text-gray-700"}`}>
                      <MapPin className="h-3.5 w-3.5 opacity-50" />All Suburbs
                    </button>
                    {suburbs.map((s) => (
                      <button key={s.id} onClick={() => { setSuburbId(String(s.id)); resetOffset(); setOpenDropdown(null); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-2 ${suburbId === String(s.id) ? "text-primary font-semibold" : "text-gray-700"}`}>
                        <MapPin className="h-3.5 w-3.5 opacity-50" />{s.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Space Type */}
            <div className="relative shrink-0">
              <button onClick={() => toggleDropdown("type")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  spaceType !== "all" ? "bg-primary border-primary text-white shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                }`}>
                <Home className="h-3.5 w-3.5" />
                {spaceType === "all" ? "Room Type" : spaceType === "EntireSpace" ? "Entire" : spaceType === "RoomSpace" ? "Private Room" : "Shared Room"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              <AnimatePresence>
                {openDropdown === "type" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl border shadow-xl z-50 py-2">
                    {SPACE_TYPES.map((opt) => (
                      <button key={opt.value} onClick={() => { setSpaceType(opt.value); resetOffset(); setOpenDropdown(null); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-2 ${spaceType === opt.value ? "text-primary font-semibold" : "text-gray-700"}`}>
                        <opt.icon className="h-3.5 w-3.5 opacity-50" />{opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Price */}
            <div className="relative shrink-0">
              <button onClick={() => toggleDropdown("price")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  priceRange[0] > 100 || priceRange[1] < 1200 ? "bg-primary border-primary text-white shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                }`}>
                {priceRange[0] > 100 || priceRange[1] < 1200 ? `$${priceRange[0]}–$${priceRange[1]}/wk` : "Budget"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              <AnimatePresence>
                {openDropdown === "price" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-2 w-68 bg-white rounded-2xl border shadow-xl z-50 p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Weekly Budget</p>
                    <div className="flex justify-between text-sm font-bold text-gray-800 mb-4">
                      <span>${priceRange[0]}<span className="font-normal text-gray-400">/wk</span></span>
                      <span>${priceRange[1]}<span className="font-normal text-gray-400">/wk</span></span>
                    </div>
                    <Slider min={100} max={1200} step={25} value={priceRange}
                      onValueChange={(v) => setPriceRange(v as [number, number])} className="mb-4" />
                    <button onClick={() => { resetOffset(); setOpenDropdown(null); }}
                      className="w-full py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90">
                      Apply
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dates */}
            <div className="relative shrink-0">
              <button onClick={() => toggleDropdown("dates")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  checkIn ? "bg-primary border-primary text-white shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                }`}>
                <Calendar className="h-3.5 w-3.5" />
                {datesLabel}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              <AnimatePresence>
                {openDropdown === "dates" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border shadow-xl z-50 p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Stay Dates</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Check-in</label>
                        <input type="date" value={checkIn}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value > checkOut) setCheckOut(""); resetOffset(); }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Check-out</label>
                        <input type="date" value={checkOut}
                          min={checkIn || new Date().toISOString().split("T")[0]}
                          onChange={(e) => { setCheckOut(e.target.value); resetOffset(); }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-primary" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {checkIn && (
                        <button onClick={() => { setCheckIn(""); setCheckOut(""); resetOffset(); }}
                          className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
                          Clear
                        </button>
                      )}
                      <button onClick={() => setOpenDropdown(null)}
                        className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90">
                        Apply
                      </button>
                    </div>
                    {checkIn && (
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        Only showing rooms available on selected dates
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Gender */}
            <div className="relative shrink-0">
              <button onClick={() => toggleDropdown("gender")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                  genderPolicy !== "all" ? "bg-primary border-primary text-white shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                }`}>
                {genderPolicy === "all" ? "Gender Policy" : genderPolicy === "FemaleOnly" ? "👩 Female Only" : "👥 Mixed"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              <AnimatePresence>
                {openDropdown === "gender" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl border shadow-xl z-50 py-2">
                    {[
                      { value: "all", label: "Any Policy" },
                      { value: "FemaleOnly", label: "👩 Female Only" },
                      { value: "Mixed", label: "👥 Mixed Gender" },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => { setGenderPolicy(opt.value); resetOffset(); setOpenDropdown(null); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 ${genderPolicy === opt.value ? "text-primary font-semibold" : "text-gray-700"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Clear */}
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-red-200 bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
                Clear {activeCount > 1 ? `(${activeCount})` : ""}
              </button>
            )}

            {/* Result count */}
            <div className="ml-auto shrink-0 flex items-center gap-1.5 text-sm text-gray-500 hidden md:flex">
              <SearchIcon className="h-3.5 w-3.5 text-primary" />
              {isLoading ? "Searching…" : `${total} rooms found`}
            </div>
          </div>
        </div>
      </div>

      {/* Close dropdown overlay */}
      {openDropdown && <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />}

      {/* ── Main body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Results Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

            {/* Result header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                {hasActiveFilters && suburbName && (
                  <p className="font-cursive text-primary text-lg italic mb-0.5">Rooms in {suburbName}</p>
                )}
                <h2 className="text-lg font-bold text-gray-800">
                  {isLoading ? "Searching…" : `${total} room${total !== 1 ? "s" : ""} in Melbourne`}
                </h2>
                {hasActiveFilters && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Filtered results ·{" "}
                    <button onClick={clearFilters} className="text-primary hover:underline font-medium">clear all</button>
                  </p>
                )}
              </div>
              <div className="hidden lg:flex items-center gap-2">
                <div className="flex gap-1">
                  {[
                    { v: "all", l: "All" },
                    { v: "RoomSpace", l: "Rooms" },
                    { v: "EntireSpace", l: "Entire" },
                  ].map((opt) => (
                    <button key={opt.v} onClick={() => { setSpaceType(opt.v); resetOffset(); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        spaceType === opt.v ? "bg-primary border-primary text-white" : "bg-white border-gray-200 text-gray-600 hover:border-primary/40"
                      }`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Suburb quick-filters */}
            {!suburbId && suburbs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {suburbs.slice(0, 8).map((s) => (
                  <button key={s.id} onClick={() => { setSuburbId(String(s.id)); resetOffset(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-orange-50 transition-all">
                    <MapPin className="h-3 w-3" />{s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Cards */}
            {isLoading && allSpaces.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border overflow-hidden bg-white animate-pulse">
                    <div className="aspect-[4/3] bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-3/4 bg-gray-200 rounded" />
                      <div className="h-3 w-1/2 bg-gray-100 rounded" />
                      <div className="h-5 w-1/3 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allSpaces.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No rooms found</h3>
                <p className="text-gray-400 mb-5 text-sm">Try adjusting your filters to see more results</p>
                <button onClick={clearFilters}
                  className="px-8 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Clear filters
                </button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {allSpaces.map((space, i) => (
                    <div key={space.id as number} id={`space-card-${space.id}`}
                      onMouseEnter={() => setHoveredId(space.id as number)}
                      onMouseLeave={() => setHoveredId(null)}>
                      <SpaceCard space={space as Parameters<typeof SpaceCard>[0]["space"]} index={i} highlighted={hoveredId === space.id} checkIn={checkIn} checkOut={checkOut} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-10 flex flex-col items-center gap-3">
                  <p className="text-sm text-gray-400">
                    Showing <span className="font-semibold text-gray-600">{allSpaces.length}</span> of{" "}
                    <span className="font-semibold text-gray-600">{total}</span> rooms
                  </p>
                  {allSpaces.length < total && (
                    <button onClick={() => setOffset((p) => p + PAGE_SIZE)} disabled={isLoading}
                      className="px-10 py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
                      {isLoading ? "Loading…" : "Load More"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <Footer />
        </div>

        {/* ── Map Panel (desktop right) ── */}
        <div className="hidden lg:flex w-[400px] xl:w-[440px] shrink-0 flex-col sticky top-[185px] h-[calc(100vh-185px)]">
          <div className="flex-1 overflow-hidden">
            <SpaceMap
              spaces={allSpaces.filter((s) => s.latitude != null && s.longitude != null) as Parameters<typeof SpaceMap>[0]["spaces"]}
              hoveredId={hoveredId}
              onMarkerHover={setHoveredId}
              onMarkerClick={handleMarkerClick}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* ── Mobile floating map button ── */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setShowMap(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold text-sm rounded-full shadow-xl hover:bg-gray-800 transition-colors"
          data-testid="button-show-map">
          <MapIcon className="h-4 w-4" /> Show map
        </button>
      </div>

      {/* ── Mobile map overlay ── */}
      <AnimatePresence>
        {showMap && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 flex flex-col">
            <div className="flex items-center gap-3 bg-white px-4 py-3 border-b shadow-sm">
              <button onClick={() => setShowMap(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
              <h3 className="font-semibold text-gray-800">Map View — {total} rooms</h3>
            </div>
            <div className="flex-1">
              <SpaceMap
                spaces={allSpaces.filter((s) => s.latitude != null && s.longitude != null) as Parameters<typeof SpaceMap>[0]["spaces"]}
                hoveredId={hoveredId}
                onMarkerHover={setHoveredId}
                onMarkerClick={(id) => { handleMarkerClick(id); setShowMap(false); }}
                className="w-full h-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
