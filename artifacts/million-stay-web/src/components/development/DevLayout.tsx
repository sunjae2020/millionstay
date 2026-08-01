import { type ReactNode, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Menu, X, ChevronDown, User, LayoutDashboard, LogOut } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/components/brand-mark";
import { CurrencySelector } from "@/components/currency-selector";
import { APP_NAME } from "@/lib/appName";
import { useAuthStore } from "@/lib/store";
import { getApiBase } from "@/lib/api-base";
import { flagIsoFor } from "@/lib/flagOverrides";
import { usePageContent, usePageSeo } from "@/lib/usePageContent";
import { useCmsPage } from "@/lib/useCmsPage";
import { useCmsBlockData } from "@/lib/useCmsBlockData";
import { BlockRenderer } from "@workspace/cms-blocks/react";
import { useCompanyContact } from "@/lib/guest-api";

// Dedicated shell for the single-building "development" site (Metheim). Four top
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

export function DevNavbar() {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { token, guest, logout } = useAuthStore();
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

  const tenantName =
    [guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || guest?.email || "";
  const handleLogout = () => { logout(); setLocation("/"); };

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
            {/* Full horizontal wordmark everywhere; smaller on mobile so it still frames cleanly. */}
            <BrandMark invert={dark} className={`h-11 sm:h-14 lg:h-[72px] w-auto ${dark ? "brightness-0 invert" : ""}`} textClassName="text-2xl sm:text-4xl" />
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

            {/* Partner portal login — shared entry for agent / owner / service host */}
            <Link
              href="/portal-login"
              className={`hidden min-[860px]:inline-flex items-center px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors whitespace-nowrap ${
                dark
                  ? "text-white/90 border-white/40 hover:text-white hover:border-white/70"
                  : "text-gray-600 border-gray-200 hover:text-primary hover:border-primary/40"
              }`}
            >
              {t("nav.partnerLogin")}
            </Link>

            {/* Tenant (guest) auth — sign-in CTA, or portal + logout when signed in */}
            {token && guest ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`hidden min-[860px]:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors whitespace-nowrap ${
                      dark
                        ? "text-white/90 border-white/40 hover:text-white hover:border-white/70"
                        : "text-gray-600 border-gray-200 hover:text-primary hover:border-primary/40"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate">{tenantName}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-1">
                  <DropdownMenuItem onClick={() => setLocation("/portal/bookings")} className="gap-2">
                    <LayoutDashboard className="h-4 w-4 text-gray-500" />
                    {t("nav.myPortal")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4" />
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="hidden min-[860px]:inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                {t("nav.tenantLogin")}
              </Link>
            )}

            <button
              className={`min-[860px]:hidden p-2 ${dark ? "text-white" : "text-gray-700 hover:text-primary"}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={t("dev.nav.menu")}
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
          <Link
            href="/portal-login"
            onClick={() => setMobileOpen(false)}
            className="block px-2 py-2.5 text-sm font-semibold text-primary border-t border-gray-100 mt-1 pt-3"
          >
            {t("nav.partnerLogin")}
          </Link>
          {token && guest ? (
            <>
              <Link
                href="/portal/bookings"
                onClick={() => setMobileOpen(false)}
                className="block px-2 py-2.5 text-sm font-semibold text-gray-700 hover:text-primary"
              >
                {t("nav.myPortal")}
              </Link>
              <button
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="block w-full text-left px-2 py-2.5 text-sm font-semibold text-red-600"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block px-2 py-2.5 text-sm font-semibold text-gray-700 hover:text-primary"
            >
              {t("nav.tenantLogin")}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function DevFooter() {
  const { t } = useTranslation();
  const company = usePageContent("dev-footer");
  const org = useCompanyContact();
  const year = new Date().getFullYear();

  // Operator info (Metheim Korea). Precedence: Settings → Organisation value if
  // set, else the CMS "dev-footer" overlay, else the localized i18n default.
  const metaAll: Array<[string, string]> = [
    [t("dev.footer.ceo_label"), org.ceo || company("ceo", t("dev.footer.ceo"))],
    [t("dev.footer.biz_no_label"), org.bizNo || company("biz_no", t("dev.footer.biz_no"))],
    [t("dev.footer.address_label"), org.address || company("address", t("dev.footer.address"))],
    [t("dev.footer.phone_label"), org.phone || company("phone", t("dev.footer.phone"))],
    [t("dev.footer.email_label"), org.email || company("email", t("dev.footer.email"))],
    [t("dev.footer.homepage_label"), org.website || company("homepage", t("dev.footer.homepage"))],
  ];
  const meta = metaAll.filter(([, v]) => v);
  const companyName = org.companyName || company("company_name", t("dev.footer.company_name"));

  return (
    <footer className="bg-[hsl(var(--brand-navy))] text-white/80 mt-auto">
      {/* Four labelled columns. The company links (소개 / 찾아오기) and the legal
          links used to be loose text under the logo and in the bottom bar, which
          is why they read as unrelated; they are one "회사" column now. On mobile
          the columns stack two-up rather than collapsing into one long list. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 lg:grid-cols-[1.3fr_2.2fr] lg:gap-16">
        <div>
          <BrandMark invert textClassName="text-3xl" className="h-12 w-auto brightness-0 invert" />
          <p className="mt-4 text-sm leading-relaxed max-w-sm">{t("dev.footer.desc")}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
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
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">{t("dev.footer.company_col")}</h4>
            <Link href="/about" className="block text-sm py-1 hover:text-white">{t("dev.nav.about")}</Link>
            <Link href="/directions" className="block text-sm py-1 hover:text-white">{t("dev.nav.directions")}</Link>
            <Link href="/privacy-policy" className="block text-sm py-1 hover:text-white">{t("dev.footer.privacy")}</Link>
            <Link href="/terms" className="block text-sm py-1 hover:text-white">{t("dev.footer.terms")}</Link>
          </div>
        </div>
      </div>

      {/* Company / operator info (Metheim Korea) */}
      {meta.length > 0 && (
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-sm font-semibold text-white/90">{companyName}</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/60">
              {meta.map(([label, value]) => (
                <span key={label}><span className="text-white/40">{label}</span> {value}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-white/10">
        {/* Legal links now live in the company column above, so the bottom bar
            carries only the copyright — one line on every screen size. */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-white/60">
          <span>© {year} {companyName}. {t("dev.footer.rights")}</span>
        </div>
      </div>
    </footer>
  );
}

export function DevLayout({
  children,
  title,
  pageKey,
  slug,
}: {
  children: ReactNode;
  title?: string;
  /**
   * The page's CMS key. Given one, the tab title and the meta description /
   * keywords come from the CMS entry for the current language, so SEO is edited
   * in the admin rather than in code. Without it the page keeps its own title.
   */
  pageKey?: string;
  /**
   * The page's CMS slug ("" for home). When an editor publishes a BLOCK version
   * of that page, this layout renders the block tree instead of `children` —
   * which is how a page moves off its built-in design without a deploy. Until
   * then nothing changes, so passing this is safe on every page.
   */
  slug?: string;
}) {
  const [location] = useLocation();

  useEffect(() => {
    document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
  }, [title]);

  // Runs after the effect above, so an authored seo_title wins over the title
  // prop while an unset one leaves the prop's value in place.
  usePageSeo(pageKey ?? "", { titleFallback: title, brand: APP_NAME });

  // A published block version replaces the built-in page body. `useCmsPage`
  // returns null while the page is still on its original design, and the hooks
  // below run unconditionally either way.
  const cmsPage = useCmsPage("dev", slug);
  const cmsData = useCmsBlockData(cmsPage?.blocks ?? [], "dev");

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
      <main className="flex-1">
        {cmsPage ? <BlockRenderer blocks={cmsPage.blocks} tokens={cmsPage.tokens} data={cmsData} /> : children}
      </main>
      <DevFooter />
    </div>
  );
}
