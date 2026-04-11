import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Menu, X, LayoutDashboard, LogOut, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import logoHorizontal from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";
import logoMark from "@assets/05.OR_NB_Mark_simple_ver_1775381659302.png";

const NAV_HREFS = [
  { key: "links.search", href: "/search" },
  { key: "links.stayPlans", href: "/stay-plan" },
  { key: "links.aboutUs", href: "/about" },
  { key: "links.forStudents", href: "/for-student" },
  { key: "links.forAgent", href: "/for-agent" },
];

const LANGUAGES = [
  { code: "en", label: "EN", iso: "au", name: "English" },
  { code: "ko", label: "KO", iso: "kr", name: "한국어" },
  { code: "zh", label: "ZH", iso: "cn", name: "中文" },
  { code: "ja", label: "JA", iso: "jp", name: "日本語" },
  { code: "th", label: "TH", iso: "th", name: "ภาษาไทย" },
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

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return (parts[0]?.[0] ?? "G").toUpperCase();
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { token, guest, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("ms_language", lang);
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const displayName = [guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || guest?.email || "Guest";
  const initials = getInitials(displayName);
  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]!;

  return (
    <header ref={navRef} className="w-full bg-white shadow-sm z-50 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <img src={logoHorizontal} alt="Million Stay" className="h-9 w-auto hidden sm:block" />
            <img src={logoMark} alt="Million Stay" className="h-9 w-auto sm:hidden" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden min-[880px]:flex items-center">
            {NAV_HREFS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap hover:text-primary ${
                  location === link.href ? "text-primary" : "text-gray-600"
                }`}
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-primary border border-gray-200 rounded-lg hover:border-primary/40 transition-colors">
                  <FlagIcon iso={currentLang.iso} size={18} />
                  <span className="hidden sm:inline">{currentLang.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                {LANGUAGES.map((lang) => {
                  const isActive = i18n.language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors text-left ${
                        isActive
                          ? "bg-orange-50 text-primary font-semibold border-l-2 border-primary"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <FlagIcon iso={lang.iso} size={20} />
                      <span className="flex-1">{lang.name}</span>
                      <span className={`text-xs font-mono ${isActive ? "text-primary" : "text-gray-400"}`}>
                        {lang.label}
                      </span>
                    </button>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auth */}
            {token && guest ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-orange-50 transition-colors group">
                  {guest.avatar_url ? (
                    <img src={guest.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {initials}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[100px] truncate group-hover:text-primary transition-colors">
                    {displayName.split(" ")[0]}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    {guest.avatar_url && (
                      <img src={guest.avatar_url} alt={displayName} className="w-10 h-10 rounded-full object-cover border border-gray-200 mb-2" />
                    )}
                    <p className="text-sm font-semibold text-gray-800">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{guest.email}</p>
                  </div>
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLocation("/login")}
                  className="hidden sm:block px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-primary transition-colors"
                >
                  {t("nav.login")}
                </button>
                <button
                  onClick={() => setLocation("/register")}
                  className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded hover:bg-primary/90 transition-colors"
                >
                  {t("nav.signup")}
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="min-[880px]:hidden p-2 rounded text-gray-500 hover:text-primary transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="min-[880px]:hidden border-t border-gray-100 py-3 space-y-1">
            {NAV_HREFS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary hover:bg-orange-50 rounded transition-colors"
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}

            {/* Mobile language switcher */}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <p className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">{t("nav.language")}</p>
              <div className="grid grid-cols-5 gap-1 px-3 py-2">
                {LANGUAGES.map((lang) => {
                  const isActive = i18n.language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => { handleLanguageChange(lang.code); setMobileOpen(false); }}
                      className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-xs transition-colors ${
                        isActive ? "bg-orange-50 text-primary font-bold border border-primary/20" : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <FlagIcon iso={lang.iso} size={24} />
                      <span className="font-mono leading-none">{lang.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {token && guest ? (
              <div className="border-t border-gray-100 mt-2 pt-2 space-y-1">
                <div className="px-3 py-1.5 flex items-center gap-2.5">
                  {guest.avatar_url ? (
                    <img src={guest.avatar_url} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{guest.email}</p>
                  </div>
                </div>
                <button onClick={() => { setMobileOpen(false); setLocation("/portal/bookings"); }} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-primary hover:bg-orange-50 rounded flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" /> {t("nav.myPortal")}
                </button>
                <button onClick={() => { setMobileOpen(false); handleLogout(); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> {t("nav.logout")}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 px-3 pt-2 border-t border-gray-100 mt-2">
                <button
                  onClick={() => { setMobileOpen(false); setLocation("/login"); }}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded hover:text-primary transition-colors"
                >
                  {t("nav.login")}
                </button>
                <button
                  onClick={() => { setMobileOpen(false); setLocation("/register"); }}
                  className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary/90 transition-colors"
                >
                  {t("nav.signup")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
