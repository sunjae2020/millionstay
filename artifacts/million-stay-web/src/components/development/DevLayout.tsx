import { type ReactNode, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Menu, X, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/components/brand-mark";
import { CurrencySelector } from "@/components/currency-selector";
import { APP_NAME } from "@/lib/appName";
import { getApiBase } from "@/lib/api-base";
import { flagIsoFor } from "@/lib/flagOverrides";

// Dedicated shell for the single-building "development" site (MetHeim). Four top
// menus — Home / About / Buy / Rent / Management / Directions — plus currency +
// language controls. Uses the instance brand tokens (--primary etc.).
//
// On the HOME page the header is a transparent overlay so the hero background
// image bleeds full-width behind the menu, language and currency controls; the
// logo + labels render white for contrast. Once the user scrolls past the hero
// the header turns solid white with dark labels. Every other page keeps the
// standard solid-white sticky header.

const NAV = [
  { key: "dev.nav.home", href: "/" },
  { key: "dev.nav.about", href: "/about" },
  { key: "dev.nav.buy", href: "/buy" },
  { key: "dev.nav.rent", href: "/rent" },
  { key: "dev.nav.management", href: "/management" },
  { key: "dev.nav.directions", href: "/directions" },
];

type LangOption = { code: string; iso: string; name: string; label: string };
const FALLBACK_LANGS: LangOption[] = [
  { code: "ko", iso: "kr", name: "한국어", label: "KO" },
  { code: "en", iso: "au", name: "English", label: "EN" },
  { code: "ja", iso: "jp", name: "日本語", label: "JA" },
  { code: "zh", iso: "cn", name: "中文", label: "ZH" },
  { code: "th", iso: "th", name: "ภาษาไทย", label: "TH" },
  { code: "vi", iso: "vn", name: "Tiếng Việt", label: "VI" },
].map((l) => ({ ...l, iso: flagIsoFor(l.code, l.iso) }));

function FlagIcon({ iso, size = 20 }: { iso: string; size?: number }) {
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@2.6.0/flags/${iso}.svg`}
      alt={iso}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      loading="eager"
    />
  );
}

function DevNavbar() {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [languages, setLanguages] = useState<LangOption[]>(FALLBACK_LANGS);
  const ref = useRef<HTMLElement>(null);

  const isHome = location === "/";
  // Transparent overlay only at the top of the home page (and not while the
  // mobile menu is open, so the white dropdown reads cleanly).
  const dark = isHome && !scrolled && !mobileOpen;

  useEffect(() => {
    if (!isHome) { setScrolled(false); return; }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBase()}/api/v1/public/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const rows = json?.data;
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setLanguages(rows.map((l: any) => ({
          code: l.code, iso: flagIsoFor(l.code, l.flag_iso || l.code),
          name: l.name || l.english_name || l.code, label: String(l.code).toUpperCase(),
        })));
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("ms_language", lang);
  };

  const currentLang = languages.find((l) => l.code === i18n.language) ?? languages[0]!;

  const headerCls = isHome
    ? `fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${dark ? "bg-gradient-to-b from-black/45 to-transparent" : "bg-white shadow-sm"}`
    : "sticky top-0 z-50 bg-white shadow-sm";

  return (
    <header ref={ref} className={headerCls}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo scaled ~2× (h-9 → h-[72px]); header height grows responsively to
            keep it framed without overflowing. */}
        <div className="flex items-center justify-between h-20 lg:h-24">
          <Link href="/" className="flex items-center shrink-0">
            <BrandMark invert={dark} className={`h-14 lg:h-[72px] w-auto hidden sm:block ${dark ? "brightness-0 invert" : ""}`} textClassName="text-4xl" />
            <BrandMark variant="mark" invert={dark} className={`h-14 w-auto sm:hidden ${dark ? "brightness-0 invert" : ""}`} textClassName="text-2xl" />
          </Link>

          <nav className="hidden min-[860px]:flex items-center gap-1">
            {NAV.map((link) => {
              const active = link.href === "/" ? location === "/" : location.startsWith(link.href);
              const cls = dark
                ? active ? "text-white" : "text-white/80 hover:text-white"
                : active ? "text-primary" : "text-gray-700 hover:text-primary";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${cls}`}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Currency — white-forced when over the hero */}
            <div className={dark ? "[&_button]:!text-white [&_button]:!border-white/40 [&_button]:hover:!border-white/70" : ""}>
              <CurrencySelector />
            </div>
            {/* Language */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                    dark
                      ? "text-white/90 border-white/40 hover:text-white hover:border-white/70"
                      : "text-gray-600 border-gray-200 hover:text-primary hover:border-primary/40"
                  }`}
                >
                  <FlagIcon iso={currentLang.iso} size={18} />
                  <span className="hidden sm:inline">{currentLang.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                {languages.map((lang) => {
                  const isActive = i18n.language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors text-left ${
                        isActive ? "bg-primary/5 text-primary font-semibold border-l-2 border-primary" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <FlagIcon iso={lang.iso} size={20} />
                      <span className="flex-1">{lang.name}</span>
                      <span className={`text-xs font-mono ${isActive ? "text-primary" : "text-gray-400"}`}>{lang.label}</span>
                    </button>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              className={`min-[860px]:hidden p-2 ${dark ? "text-white" : "text-gray-700 hover:text-primary"}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="min-[860px]:hidden border-t border-gray-100 bg-white px-4 py-2">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-2 py-2.5 text-sm font-semibold text-gray-700 hover:text-primary"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function DevFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[hsl(var(--brand-navy))] text-white/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandMark invert textClassName="text-3xl" className="h-[54px] w-auto brightness-0 invert" />
          <p className="mt-4 text-sm leading-relaxed max-w-xs">{t("dev.footer.desc")}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/about" className="text-sm hover:text-white">{t("dev.nav.about")}</Link>
            <Link href="/directions" className="text-sm hover:text-white">{t("dev.nav.directions")}</Link>
          </div>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">{t("dev.nav.buy")}</h4>
          <Link href="/buy" className="block text-sm py-1 hover:text-white">{t("dev.footer.buy_link")}</Link>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">{t("dev.nav.rent")}</h4>
          <Link href="/rent" className="block text-sm py-1 hover:text-white">{t("dev.rent.short_title")}</Link>
          <Link href="/rent#long-term" className="block text-sm py-1 hover:text-white">{t("dev.rent.long_title")}</Link>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">{t("dev.nav.management")}</h4>
          <Link href="/management" className="block text-sm py-1 hover:text-white">{t("dev.footer.mgmt_link")}</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-white/60">
          © {year} {APP_NAME}. {t("dev.footer.rights")}
        </div>
      </div>
    </footer>
  );
}

export function DevLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();

  useEffect(() => {
    document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
  }, [title]);

  // Scroll to #hash target on navigation (long-term / anchored sections), else top.
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) { window.scrollTo(0, 0); return; }
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo(0, 0);
    };
    const tmr = setTimeout(scrollToHash, 60);
    window.addEventListener("hashchange", scrollToHash);
    return () => { clearTimeout(tmr); window.removeEventListener("hashchange", scrollToHash); };
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800">
      <DevNavbar />
      <main className="flex-1">{children}</main>
      <DevFooter />
    </div>
  );
}
