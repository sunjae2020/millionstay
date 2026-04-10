import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useListSuburbs } from "@workspace/api-client-react";
import { useListPublicSpaces, getListPublicSpacesQueryKey } from "@/lib/guest-api";
import { Navbar } from "@/components/navbar";
import { SpaceCard } from "@/components/space-card";
import { Footer } from "@/components/footer";
import { Slider } from "@/components/ui/slider";
import {
  MapPin, X, ChevronDown, ChevronUp, Search as SearchIcon,
  Home, Building2, BedDouble, ChevronRight, Calendar, SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DateInput } from "@/components/ui/date-input";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";

const PAGE_SIZE = 20;
type SuburbDropdown = "suburb" | null;

const SPACE_TYPES = [
  { value: "all",         label: "Any Type",      icon: Home },
  { value: "EntireSpace", label: "Entire Space",  icon: Building2 },
  { value: "RoomSpace",   label: "Private Room",  icon: BedDouble },
  { value: "BedSpace",    label: "Shared Room",   icon: BedDouble },
];

const GENDER_OPTIONS = [
  { value: "all",        label: "Any" },
  { value: "FemaleOnly", label: "👩 Female Only" },
  { value: "Mixed",      label: "👥 Mixed" },
];

const today = new Date().toISOString().split("T")[0];

export default function Search() {
  const { t } = useTranslation();
  const [_location] = useLocation();

  /* ── Read initial state from URL params ── */
  const getUrlParams = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      suburb_id:    p.get("suburb_id") ?? "",
      space_type:   p.get("space_type") ?? "all",
      gender_policy: p.get("gender_policy") ?? "all",
      min_price:    Number(p.get("min_price") ?? 100),
      max_price:    Number(p.get("max_price") ?? 1200),
      check_in:     p.get("check_in") ?? "",
      check_out:    p.get("check_out") ?? "",
    };
  };

  const init = getUrlParams();

  /* ── Basic search state ── */
  const [suburbId, setSuburbId]   = useState(init.suburb_id);
  const [checkIn,  setCheckIn]    = useState(init.check_in);
  const [checkOut, setCheckOut]   = useState(init.check_out);

  /* ── Advanced filter state ── */
  const [spaceType,    setSpaceType]    = useState(init.space_type);
  const [genderPolicy, setGenderPolicy] = useState(init.gender_policy);
  const [priceRange,   setPriceRange]   = useState<[number, number]>([init.min_price, init.max_price]);

  /* ── UI state ── */
  const [offset,          setOffset]          = useState(0);
  const [allSpaces,       setAllSpaces]        = useState<Record<string, unknown>[]>([]);
  const [suburbOpen,      setSuburbOpen]       = useState<SuburbDropdown>(null);
  const [showAdvanced,    setShowAdvanced]     = useState(
    // Auto-open advanced if any advanced filter is active from URL
    init.space_type !== "all" || init.gender_policy !== "all" ||
    init.min_price > 100 || init.max_price < 1200
  );
  const [hoveredId,       setHoveredId]        = useState<number | string | null>(null);

  const { data: suburbsData } = useListSuburbs();
  const suburbs = suburbsData?.data ?? [];

  /* ── API query params ── */
  const queryParams = {
    suburb_id:    suburbId ? parseInt(suburbId) : undefined,
    space_type:   spaceType !== "all" ? (spaceType as "EntireSpace" | "RoomSpace" | "BedSpace") : undefined,
    gender_policy: genderPolicy !== "all" ? (genderPolicy as "FemaleOnly" | "Mixed") : undefined,
    min_price:    priceRange[0] > 100  ? priceRange[0] : undefined,
    max_price:    priceRange[1] < 1200 ? priceRange[1] : undefined,
    start_date:   checkIn  || undefined,
    end_date:     checkOut || undefined,
    limit:        PAGE_SIZE,
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

  const clearBasic = () => {
    setSuburbId(""); setCheckIn(""); setCheckOut(""); resetOffset();
  };
  const clearAdvanced = () => {
    setSpaceType("all"); setGenderPolicy("all"); setPriceRange([100, 1200]); resetOffset();
  };
  const clearAll = () => { clearBasic(); clearAdvanced(); };

  /* ── Active filter counts ── */
  const hasBasicFilters   = !!suburbId || !!checkIn;
  const advancedFilters   = [spaceType !== "all", genderPolicy !== "all", priceRange[0] > 100 || priceRange[1] < 1200];
  const advancedCount     = advancedFilters.filter(Boolean).length;
  const hasAdvancedFilters = advancedCount > 0;
  const hasAnyFilters      = hasBasicFilters || hasAdvancedFilters;

  const suburbName = suburbs.find((s) => String(s.id) === suburbId)?.name ?? null;


  /* ── Date label helper ── */
  const fmtDate = (d: string) =>
    d ? new Date(d + "T00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "";

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="relative h-52 md:h-60 overflow-hidden shrink-0">
        <img src={heroBg} alt="Search" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/80 text-lg italic mb-1">Find Your Perfect</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">Place</h1>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">Search</span>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Sticky Search Area
      ══════════════════════════════════════════════════════════ */}
      <div className="sticky top-16 z-40 bg-white shadow-sm shrink-0">

        {/* ── Row 1: Basic Search ── */}
        <div className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
            <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>

              {/* Suburb */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setSuburbOpen((p) => (p === "suburb" ? null : "suburb"))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    suburbId ? "bg-primary border-primary text-white shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {suburbName ?? "Any suburb"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                <AnimatePresence>
                  {suburbOpen === "suburb" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl border shadow-xl z-50 py-2 max-h-64 overflow-y-auto"
                    >
                      <button
                        onClick={() => { setSuburbId(""); resetOffset(); setSuburbOpen(null); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-2 ${!suburbId ? "text-primary font-semibold" : "text-gray-700"}`}
                      >
                        <MapPin className="h-3.5 w-3.5 opacity-50" />All Suburbs
                      </button>
                      {suburbs.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSuburbId(String(s.id)); resetOffset(); setSuburbOpen(null); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-2 ${suburbId === String(s.id) ? "text-primary font-semibold" : "text-gray-700"}`}
                        >
                          <MapPin className="h-3.5 w-3.5 opacity-50" />{s.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-200 shrink-0" />

              {/* Check In */}
              <div className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border transition-all shrink-0 ${
                checkIn ? "border-primary bg-orange-50" : "border-gray-200 bg-white hover:border-primary/50"
              }`}>
                <Calendar className={`h-3.5 w-3.5 shrink-0 ${checkIn ? "text-primary" : "text-gray-400"}`} />
                <div className="flex flex-col leading-none min-w-[88px]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Check In</span>
                  <DateInput
                    noIcon
                    value={checkIn}
                    min={today}
                    onChange={(iso) => {
                      setCheckIn(iso);
                      if (checkOut && iso > checkOut) setCheckOut("");
                      resetOffset();
                    }}
                    className={`bg-transparent text-xs font-semibold p-0 w-full ${checkIn ? "text-primary" : "text-gray-500"}`}
                  />
                </div>
                {checkIn && (
                  <button
                    onClick={() => { setCheckIn(""); setCheckOut(""); resetOffset(); }}
                    className="ml-0.5 h-4 w-4 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5 text-primary" />
                  </button>
                )}
              </div>

              <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0 -mx-0.5" />

              {/* Check Out */}
              <div className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border transition-all shrink-0 ${
                checkOut ? "border-primary bg-orange-50" : "border-gray-200 bg-white hover:border-primary/50"
              }`}>
                <Calendar className={`h-3.5 w-3.5 shrink-0 ${checkOut ? "text-primary" : "text-gray-400"}`} />
                <div className="flex flex-col leading-none min-w-[88px]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Check Out</span>
                  <DateInput
                    noIcon
                    value={checkOut}
                    min={checkIn || today}
                    onChange={(iso) => { setCheckOut(iso); resetOffset(); }}
                    className={`bg-transparent text-xs font-semibold p-0 w-full ${checkOut ? "text-primary" : "text-gray-500"}`}
                  />
                </div>
                {checkOut && (
                  <button
                    onClick={() => { setCheckOut(""); resetOffset(); }}
                    className="ml-0.5 h-4 w-4 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5 text-primary" />
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-200 shrink-0" />

              {/* Advanced Search Toggle */}
              <button
                onClick={() => setShowAdvanced((p) => !p)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all shrink-0 ${
                  showAdvanced || hasAdvancedFilters
                    ? "bg-gray-800 border-gray-800 text-white shadow-sm"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Advanced
                {advancedCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold">
                    {advancedCount}
                  </span>
                )}
                {showAdvanced
                  ? <ChevronUp className="h-3.5 w-3.5 opacity-60" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                }
              </button>

              {/* Clear all */}
              {hasAnyFilters && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 px-3 py-2 rounded-full border border-red-200 bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}

              {/* Result count */}
              <div className="ml-auto shrink-0 hidden md:flex items-center gap-1.5 text-sm text-gray-500">
                <SearchIcon className="h-3.5 w-3.5 text-primary" />
                {isLoading ? "Searching…" : `${total} rooms found`}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Advanced Filters (persistent) ── */}
        <AnimatePresence initial={false}>
          {showAdvanced && (
            <motion.div
              key="advanced"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden border-b border-gray-100 bg-gray-50"
            >
              <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                <div className="flex flex-wrap gap-x-8 gap-y-4 items-start">

                  {/* Room Type */}
                  <div className="shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Room Type</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {SPACE_TYPES.map((opt) => {
                        const active = spaceType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { setSpaceType(opt.value); resetOffset(); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              active
                                ? "bg-primary border-primary text-white shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary"
                            }`}
                          >
                            <opt.icon className="h-3 w-3" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vertical divider */}
                  <div className="hidden md:block h-14 w-px bg-gray-200 self-center" />

                  {/* Budget */}
                  <div className="shrink-0 min-w-[220px]">
                    <div className="flex justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Weekly Budget</p>
                      <p className="text-xs font-semibold text-primary">
                        ${priceRange[0]} – ${priceRange[1]}<span className="font-normal text-gray-400">/wk</span>
                      </p>
                    </div>
                    <Slider
                      min={100} max={1200} step={25}
                      value={priceRange}
                      onValueChange={(v) => { setPriceRange(v as [number, number]); resetOffset(); }}
                      className="mt-1"
                    />
                  </div>

                  {/* Vertical divider */}
                  <div className="hidden md:block h-14 w-px bg-gray-200 self-center" />

                  {/* Gender Policy */}
                  <div className="shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Gender Policy</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {GENDER_OPTIONS.map((opt) => {
                        const active = genderPolicy === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { setGenderPolicy(opt.value); resetOffset(); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              active
                                ? "bg-primary border-primary text-white shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:border-primary/50 hover:text-primary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clear advanced */}
                  {hasAdvancedFilters && (
                    <div className="self-end ml-auto shrink-0">
                      <button
                        onClick={clearAdvanced}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Close suburb dropdown overlay */}
      {suburbOpen && <div className="fixed inset-0 z-30" onClick={() => setSuburbOpen(null)} />}

      {/* ── Main body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Results Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

            {/* Date availability notice */}
            <AnimatePresence>
              {(checkIn || checkOut) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 mb-5"
                >
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 text-sm text-gray-700">
                    {checkIn && checkOut ? (
                      <>
                        Showing rooms available{" "}
                        <span className="font-semibold text-primary">
                          {fmtDate(checkIn)} → {fmtDate(checkOut)}
                        </span>
                      </>
                    ) : checkIn ? (
                      <>Check-in from <span className="font-semibold text-primary">{fmtDate(checkIn)}</span> — add a check-out date to filter availability</>
                    ) : null}
                  </div>
                  <button
                    onClick={() => { setCheckIn(""); setCheckOut(""); resetOffset(); }}
                    className="text-xs text-gray-400 hover:text-primary font-medium transition-colors shrink-0"
                  >
                    Clear dates
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                {suburbName && (
                  <p className="font-cursive text-primary text-lg italic mb-0.5">Rooms in {suburbName}</p>
                )}
                <h2 className="text-lg font-bold text-gray-800">
                  {isLoading ? "Searching…" : `${total} room${total !== 1 ? "s" : ""} in Melbourne`}
                </h2>
                {hasAnyFilters && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Filtered results ·{" "}
                    <button onClick={clearAll} className="text-primary hover:underline font-medium">clear all</button>
                  </p>
                )}
              </div>
              {/* Quick type tabs (desktop) */}
              <div className="hidden lg:flex gap-1">
                {[
                  { v: "all",         l: "All" },
                  { v: "RoomSpace",   l: "Private" },
                  { v: "EntireSpace", l: "Entire" },
                  { v: "BedSpace",    l: "Shared" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => { setSpaceType(opt.v); resetOffset(); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      spaceType === opt.v
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-primary/40"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Suburb quick-filters */}
            {!suburbId && suburbs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {suburbs.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSuburbId(String(s.id)); resetOffset(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-orange-50 transition-all"
                  >
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
                <button
                  onClick={clearAll}
                  className="px-8 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Clear filters
                </button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {allSpaces.map((space, i) => (
                    <div
                      key={space.id as number}
                      id={`space-card-${space.id}`}
                      onMouseEnter={() => setHoveredId(space.id as number)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <SpaceCard
                        space={space as Parameters<typeof SpaceCard>[0]["space"]}
                        index={i}
                        highlighted={hoveredId === space.id}
                        checkIn={checkIn}
                        checkOut={checkOut}
                      />
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
                    <button
                      onClick={() => setOffset((p) => p + PAGE_SIZE)}
                      disabled={isLoading}
                      className="px-10 py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
                    >
                      {isLoading ? "Loading…" : "Load More"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <Footer />
        </div>

      </div>
    </div>
  );
}
