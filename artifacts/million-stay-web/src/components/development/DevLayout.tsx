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

// Dedicated shell for the single-building "development" site (MetHeim). Four top
// menus — Home / Buy / Rent / Management — plus currency + language controls.
// Uses the instance brand tokens (--primary etc.), so a white-label palette
// (MetHeim teal) flows in without any per-page colour code.

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
];

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
  const [languages, setLanguages] = useState<LangOption[]>(FALLBACK_LANGS);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBase()}/api/v1/public/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const rows = json?.data;
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setLanguages(rows.map((l: any) => ({
          code: l.code, iso: l.flag_iso || l.code,
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

  return (
    <header ref={ref} className="w-full bg-white shadow-sm z-50 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center shrink-0">
            <BrandMark className="h-9 w-auto hidden sm:block" textClassName="text-2xl" />
            <BrandMark variant="mark" className="h-9 w-auto sm:hidden" textClassName="text-xl" />
          </Link>

          <nav className="hidden min-[760px]:flex items-center gap-1">
            {NAV.map((link) => {
              const active = link.href === "/" ? location === "/" : location.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap hover:text-primary ${
                    active ? "text-primary" : "text-gray-700"
                  }`}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <CurrencySelector />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-primary border border-gray-200 rounded-lg hover:border-primary/40 transition-colors">
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
              className="min-[760px]:hidden p-2 text-gray-700 hover:text-primary"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="min-[760px]:hidden border-t border-gray-100 bg-white px-4 py-2">
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
          <BrandMark invert textClassName="text-2xl" className="h-9 w-auto" />
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
