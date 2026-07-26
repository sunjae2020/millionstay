import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useListSuburbs } from "@workspace/api-client-react";
import { useListPublicSpaces, getListPublicSpacesQueryKey } from "@/lib/guest-api";
import { FALLBACK_SPACES } from "@/lib/fallback-spaces";
import { Navbar } from "@/components/navbar";
import { SpaceCard } from "@/components/space-card";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Slider } from "@/components/ui/slider";
import {
  MapPin, X, ChevronDown, ChevronUp, Search as SearchIcon,
  Home, Building2, BedDouble, ChevronRight, Calendar, SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DateInput } from "@/components/ui/date-input";
import heroBg from "@assets/MS_Homepage_Photo_1920x1080_1775403929888.jpg";
import { formatDate } from "@/lib/dateFormat";

const PAGE_SIZE = 9;
type SuburbDropdown = "suburb" | null;

const today = new Date().toISOString().split("T")[0];

// On the single-building "development" instance (Metheim) the shared search page
// must wear the same shell as the landing site — the DevLayout logo/menu header
// and navy footer — so the header, mobile menu and footer read identically to
// the main landing page. Standard instances keep the MillionStay Navbar/Footer.
const DEV_SITE = isDevelopmentSite();

export default function Search() {
  const { t } = useTranslation();

  // Room-type tabs (header, immediate apply). Single source of truth now that the
  // duplicate Room Type block was removed from the advanced filter panel.
  const TYPE_TABS = [
    { v: "all",         l: t("search.tab_all") },
    { v: "RoomSpace",   l: t("search.tab_private") },
    { v: "EntireSpace", l: t("search.tab_entire") },
    { v: "BedSpace",    l: t("search.tab_shared") },
    { v: "Homestay",    l: t("search.tab_homestay") },
  ];

  const GENDER_OPTIONS = [
    { value: "all",        label: t("search.gender_any") },
    { value: "FemaleOnly", label: t("search.gender_female") },
    { value: "Mixed",      label: t("search.gender_mixed") },
  ];
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

  /* ── Input filter state (편집 중) ── */
  const [suburbId,     setSuburbId]     = useState(init.suburb_id);
  const [checkIn,      setCheckIn]      = useState(init.check_in);
  const [checkOut,     setCheckOut]     = useState(init.check_out);
  const [spaceType,    setSpaceType]    = useState(init.space_type);
  const [genderPolicy, setGenderPolicy] = useState(init.gender_policy);
  const [priceRange,   setPriceRange]   = useState<[number, number]>([init.min_price, init.max_price]);

  /* ── Applied filter state (실제 쿼리에 사용) ── */
  const [applied, setApplied] = useState({
    suburb_id:     init.suburb_id,
    check_in:      init.check_in,
    check_out:     init.check_out,
    space_type:    init.space_type,
    gender_policy: init.gender_policy,
    min_price:     init.min_price,
    max_price:     init.max_price,
  });

  /* ── Dirty: 입력값이 applied와 다를 때 ── */
  const isDirty =
    suburbId !== applied.suburb_id ||
    checkIn  !== applied.check_in  ||
    checkOut !== applied.check_out ||
    spaceType    !== applied.space_type    ||
    genderPolicy !== applied.gender_policy ||
    priceRange[0] !== applied.min_price   ||
    priceRange[1] !== applied.max_price;

  /* ── UI state ── */
  const [page,         setPage]      = useState(1);
  const [suburbOpen,   setSuburbOpen] = useState<SuburbDropdown>(null);
  const [showAdvanced, setShowAdvanced] = useState(
    init.gender_policy !== "all" ||
    init.min_price > 100 || init.max_price < 1200
  );
  const [hoveredId, setHoveredId] = useState<number | string | null>(null);

  const { data: suburbsData } = useListSuburbs();
  const suburbs = suburbsData ?? [];

  /* ── Search 버튼 클릭: 현재 입력값을 applied에 반영 ── */
  const handleSearch = () => {
    setApplied({
      suburb_id:     suburbId,
      check_in:      checkIn,
      check_out:     checkOut,
      space_type:    spaceType,
      gender_policy: genderPolicy,
      min_price:     priceRange[0],
      max_price:     priceRange[1],
    });
    setPage(1);
    setSuburbOpen(null);
  };

  /* ── API query params (applied 기반, page 기반) ── */
  const queryParams = {
    suburb_id:    applied.suburb_id ? parseInt(applied.suburb_id) : undefined,
    space_type:   applied.space_type !== "all" ? (applied.space_type as "EntireSpace" | "RoomSpace" | "BedSpace" | "Homestay") : undefined,
    gender_policy: applied.gender_policy !== "all" ? (applied.gender_policy as "FemaleOnly" | "Mixed") : undefined,
    min_price:    applied.min_price > 100  ? applied.min_price : undefined,
    max_price:    applied.max_price < 1200 ? applied.max_price : undefined,
    start_date:   applied.check_in  || undefined,
    end_date:     applied.check_out || undefined,
    limit:        PAGE_SIZE,
    offset:       (page - 1) * PAGE_SIZE,
  };

  const { data: spacesData, isLoading } = useListPublicSpaces(queryParams, {
    query: { queryKey: getListPublicSpacesQueryKey(queryParams) },
  });

  const apiTotal = (spacesData?.meta as Record<string, unknown>)?.total as number ?? 0;
  const apiSpaces = (spacesData?.data ?? []) as unknown as Record<string, unknown>[];
  // If the API returns nothing AND no filters are active, show the curated
  // fallback list of real DB spaces so the page is never empty.
  const noFiltersActive =
    !applied.suburb_id && !applied.check_in && !applied.check_out &&
    applied.space_type === "all" && applied.gender_policy === "all" &&
    applied.min_price <= 100 && applied.max_price >= 1200;
  const useFallback = !isLoading && apiSpaces.length === 0 && noFiltersActive;
  const allSpaces = useFallback ? (FALLBACK_SPACES as unknown as Record<string, unknown>[]) : apiSpaces;
  const total = useFallback ? FALLBACK_SPACES.length : apiTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* 페이지 변경 시 결과 영역으로 스크롤 */
  const goToPage = (p: number) => {
    setPage(p);
    document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearBasic = () => {
    setSuburbId(""); setCheckIn(""); setCheckOut("");
  };
  const clearAdvanced = () => {
    setGenderPolicy("all"); setPriceRange([100, 1200]);
  };
  const clearAll = () => {
    setSuburbId(""); setCheckIn(""); setCheckOut("");
    setSpaceType("all"); setGenderPolicy("all"); setPriceRange([100, 1200]);
    setApplied({ suburb_id: "", check_in: "", check_out: "", space_type: "all", gender_policy: "all", min_price: 100, max_price: 1200 });
    setPage(1);
  };

  /* ── Active filter counts (applied 기준으로 표시) ── */
  const hasBasicFilters    = !!applied.suburb_id || !!applied.check_in;
  const advancedFilters    = [applied.gender_policy !== "all", applied.min_price > 100 || applied.max_price < 1200];
  const advancedCount      = advancedFilters.filter(Boolean).length;
  const hasAdvancedFilters = advancedCount > 0;
  const hasAnyFilters      = hasBasicFilters || hasAdvancedFilters;

  /* ── Advanced clear: input + applied 함께 초기화 ── */
  const clearAdvancedAll = () => {
    clearAdvanced();
    setApplied((p) => ({ ...p, gender_policy: "all", min_price: 100, max_price: 1200 }));
    setPage(1);
  };

  const suburbName = suburbs.find((s) => String(s.id) === suburbId)?.name ?? null;
  const appliedSuburbName = suburbs.find((s) => String(s.id) === applied.suburb_id)?.name ?? null;


  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}

      {/* ── Hero Banner ── */}
      <div className="relative h-52 md:h-60 overflow-hidden shrink-0">
        <img src={heroBg} alt="Search" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/55" />
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="font-cursive text-white/80 text-lg italic mb-1">{t("search.hero_tagline")}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white italic">{t("search.hero_title")}</h1>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
        <Link href="/" className="hover:text-primary transition-colors">{t("search.breadcrumb_home")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-600 font-medium">{t("search.breadcrumb")}</span>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Sticky Search Area
      ══════════════════════════════════════════════════════════ */}
      <div className={`sticky ${DEV_SITE ? "top-20 lg:top-24" : "top-16"} z-40 bg-white shadow-sm shrink-0`}>

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
                  {suburbName ?? t("search.any_suburb")}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                <AnimatePresence>
                  {suburbOpen === "suburb" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl border shadow-xl z-50 py-2 max-h-64 overflow-y-auto"
                    >
                      <button
                        onClick={() => { setSuburbId(""); setSuburbOpen(null); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 flex items-center gap-2 ${!suburbId ? "text-primary font-semibold" : "text-gray-700"}`}
                      >
                        <MapPin className="h-3.5 w-3.5 opacity-50" />{t("search.all_suburbs")}
                      </button>
                      {suburbs.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSuburbId(String(s.id)); setSuburbOpen(null); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 flex items-center gap-2 ${suburbId === String(s.id) ? "text-primary font-semibold" : "text-gray-700"}`}
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
                checkIn ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-primary/50"
              }`}>
                <Calendar className={`h-3.5 w-3.5 shrink-0 ${checkIn ? "text-primary" : "text-gray-400"}`} />
                <div className="flex flex-col leading-none min-w-[88px]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{t("search.check_in")}</span>
                  <DateInput
                    noIcon
                    value={checkIn}
                    min={today}
                    onChange={(iso) => {
                      setCheckIn(iso);
                      if (checkOut && iso > checkOut) setCheckOut("");
                    }}
                    className={`bg-transparent text-xs font-semibold p-0 w-full ${checkIn ? "text-primary" : "text-gray-500"}`}
                  />
                </div>
                {checkIn && (
                  <button
                    onClick={() => { setCheckIn(""); setCheckOut(""); }}
                    className="ml-0.5 h-4 w-4 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5 text-primary" />
                  </button>
                )}
              </div>

              <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0 -mx-0.5" />

              {/* Check Out */}
              <div className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border transition-all shrink-0 ${
                checkOut ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-primary/50"
              }`}>
                <Calendar className={`h-3.5 w-3.5 shrink-0 ${checkOut ? "text-primary" : "text-gray-400"}`} />
                <div className="flex flex-col leading-none min-w-[88px]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{t("search.check_out")}</span>
                  <DateInput
                    noIcon
                    value={checkOut}
                    min={checkIn || today}
                    onChange={(iso) => { setCheckOut(iso); }}
                    className={`bg-transparent text-xs font-semibold p-0 w-full ${checkOut ? "text-primary" : "text-gray-500"}`}
                  />
                </div>
                {checkOut && (
                  <button
                    onClick={() => { setCheckOut(""); }}
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
                {t("search.advanced")}
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

              {/* ── Search Button ── */}
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className={`relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all shrink-0 shadow-sm ${
                  isDirty
                    ? "bg-primary border border-primary text-white hover:bg-primary/90 animate-pulse"
                    : "bg-primary border border-primary text-white hover:bg-primary/90"
                }`}
              >
                <SearchIcon className="h-3.5 w-3.5" />
                {t("search.search_btn")}
                {isDirty && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-yellow-400 border-2 border-white" />
                )}
              </button>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-200 shrink-0" />

              {/* Clear all */}
              {hasAnyFilters && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 px-3 py-2 rounded-full border border-red-200 bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("search.clear")}
                </button>
              )}

              {/* Result count */}
              <div className="ml-auto shrink-0 hidden md:flex items-center gap-1.5 text-sm text-gray-500">
                <SearchIcon className="h-3.5 w-3.5 text-primary" />
                {isLoading ? t("search.searching") : t("search.rooms_found", { count: total })}
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

                  {/* Budget */}
                  <div className="shrink-0 min-w-[220px]">
                    <div className="flex justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("search.weekly_budget")}</p>
                      <p className="text-xs font-semibold text-primary">
                        ${priceRange[0]} – ${priceRange[1]}<span className="font-normal text-gray-400">{t("search.per_week")}</span>
                      </p>
                    </div>
                    <Slider
                      min={100} max={1200} step={25}
                      value={priceRange}
                      onValueChange={(v) => { setPriceRange(v as [number, number]); }}
                      className="mt-1"
                    />
                  </div>

                  {/* Vertical divider */}
                  <div className="hidden md:block h-14 w-px bg-gray-200 self-center" />

                  {/* Gender Policy */}
                  <div className="shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{t("search.gender_policy")}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {GENDER_OPTIONS.map((opt) => {
                        const active = genderPolicy === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => { setGenderPolicy(opt.value); }}
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
                        onClick={clearAdvancedAll}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> {t("search.clear_filters")}
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

            {/* Date availability notice (applied 기반) */}
            <AnimatePresence>
              {(applied.check_in || applied.check_out) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-5"
                >
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 text-sm text-gray-700">
                    {applied.check_in && applied.check_out ? (
                      <>
                        {t("search.showing_available")}{" "}
                        <span className="font-semibold text-primary">
                          {formatDate(applied.check_in, "")} → {formatDate(applied.check_out, "")}
                        </span>
                      </>
                    ) : applied.check_in ? (
                      <>{t("search.check_in_from")} <span className="font-semibold text-primary">{formatDate(applied.check_in, "")}</span> — {t("search.add_checkout")}</>
                    ) : null}
                  </div>
                  <button
                    onClick={() => {
                      setCheckIn(""); setCheckOut("");
                      setApplied((p) => ({ ...p, check_in: "", check_out: "" }));
                      setPage(1);
                    }}
                    className="text-xs text-gray-400 hover:text-primary font-medium transition-colors shrink-0"
                  >
                    {t("search.clear_dates")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
              <div>
                {appliedSuburbName && (
                  <p className="font-cursive text-primary text-lg italic mb-0.5">{t("search.rooms_in", { suburb: appliedSuburbName })}</p>
                )}
                <h2 className="text-lg font-bold text-gray-800">
                  {isLoading ? t("search.searching") : t("search.rooms_in_melbourne", { count: total })}
                </h2>
                {hasAnyFilters && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t("search.filtered")} ·{" "}
                    <button onClick={clearAll} className="text-primary hover:underline font-medium">{t("search.clear_all")}</button>
                  </p>
                )}
              </div>
              {/* Quick type tabs — 즉시 Search 적용 (모바일에서는 가로 스크롤) */}
              <div className="flex gap-1 overflow-x-auto -mx-1 px-1 lg:mx-0 lg:px-0 pb-1 lg:pb-0" style={{ scrollbarWidth: "none" }}>
                {TYPE_TABS.map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => {
                      setSpaceType(opt.v);
                      setApplied((p) => ({ ...p, space_type: opt.v }));
                      setPage(1);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      applied.space_type === opt.v
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-primary/40"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Suburb quick-filters — 즉시 Search 적용 */}
            {!applied.suburb_id && suburbs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {suburbs.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const sid = String(s.id);
                      setSuburbId(sid);
                      setApplied((p) => ({ ...p, suburb_id: sid }));
                      setPage(1);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <MapPin className="h-3 w-3" />{s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Cards */}
            <div id="search-results" />
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">{t("search.no_rooms_title")}</h3>
                <p className="text-gray-400 mb-5 text-sm">{t("search.no_rooms_desc")}</p>
                <button
                  onClick={clearAll}
                  className="px-8 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  {t("search.clear_filters")}
                </button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {allSpaces.map((space, i) => (
                    <div
                      key={space.id as number}
                      id={`space-card-${space.id}`}
                      onMouseEnter={() => setHoveredId(space.id as number)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <SpaceCard
                        space={space as unknown as Parameters<typeof SpaceCard>[0]["space"]}
                        index={i}
                        highlighted={hoveredId === space.id}
                        checkIn={checkIn}
                        checkOut={checkOut}
                      />
                    </div>
                  ))}
                </div>

                {/* Numbered Pagination */}
                {totalPages > 1 && (
                  <div className="mt-10 flex flex-col items-center gap-4">
                    <p className="text-sm text-gray-400">
                      {t("search.page_of", { page, total: totalPages })}
                      {" "}·{" "}
                      {t("search.rooms_total", { count: total })}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {/* Prev */}
                      <button
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1}
                        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-sm text-gray-500 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-white"
                        aria-label="Previous page"
                      >
                        ‹
                      </button>

                      {/* Page numbers */}
                      {(() => {
                        const range: (number | "…")[] = [];
                        const delta = 2;
                        for (let i = 1; i <= totalPages; i++) {
                          if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
                            range.push(i);
                          } else if (range[range.length - 1] !== "…") {
                            range.push("…");
                          }
                        }
                        return range.map((r, idx) =>
                          r === "…" ? (
                            <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">…</span>
                          ) : (
                            <button
                              key={r}
                              onClick={() => goToPage(r as number)}
                              className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                                page === r
                                  ? "bg-primary border-primary text-white shadow-sm"
                                  : "bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                              }`}
                            >
                              {r}
                            </button>
                          )
                        );
                      })()}

                      {/* Next */}
                      <button
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages}
                        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-sm text-gray-500 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-white"
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {DEV_SITE ? <DevFooter /> : <Footer />}
        </div>

      </div>
    </div>
  );
}
