import { Link, useLocation } from "wouter";
import { APP_NAME } from "../lib/appName";
import { useAuthStore } from "@/lib/store";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  FileText,
  FileImage,
  Headphones,
  User,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home,
  Globe,
} from "lucide-react";
import logoHorizontal from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";
import logoMark from "@assets/05.OR_NB_Mark_simple_ver_1775381659302.png";

const LANGUAGES = [
  { code: "en", flag: "🇦🇺", label: "EN" },
  { code: "ko", flag: "🇰🇷", label: "KO" },
  { code: "zh", flag: "🇨🇳", label: "ZH" },
  { code: "ja", flag: "🇯🇵", label: "JA" },
  { code: "th", flag: "🇹🇭", label: "TH" },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors w-full"
      >
        <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-sm">{current.flag}</span>
        <span>{current.label}</span>
        <ChevronRight className={`h-3 w-3 ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); localStorage.setItem("ms_language", lang.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-orange-50 hover:text-primary transition-colors ${
                lang.code === i18n.language ? "bg-orange-50 text-primary font-semibold" : "text-gray-600"
              }`}
            >
              <span className="text-sm">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return (parts[0]?.[0] ?? "G").toUpperCase();
}

interface PortalLayoutProps {
  children: React.ReactNode;
  active: string;
}

export function PortalLayout({ children, active }: PortalLayoutProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { guest, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_ITEMS = [
    { href: "/portal/bookings", labelKey: "portal.nav.bookings", icon: BookOpen },
    { href: "/portal/invoices", labelKey: "portal.nav.invoices", icon: FileText },
    { href: "/portal/documents", labelKey: "portal.nav.documents", icon: FileImage },
    { href: "/portal/cs", labelKey: "portal.nav.cs", icon: Headphones },
    { href: "/portal/profile", labelKey: "portal.nav.profile", icon: User },
    { href: "/portal/my-data", labelKey: "portal.nav.my_data", icon: Shield },
  ];

  const displayName = [guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || guest?.email || "Guest";
  const initials = displayName ? getInitials(displayName) : "G";

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const isActive = (href: string) => {
    if (href === "/portal/cs") return active.startsWith("/portal/cs");
    if (href === "/portal/bookings") return active.startsWith("/portal/bookings");
    return active === href;
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-gray-100 fixed top-0 left-0 h-full z-30">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <img src={logoHorizontal} alt={APP_NAME} className="h-8 w-auto" />
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            {t("portal.my_portal")}
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active_ = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active_
                      ? "bg-orange-50 text-primary"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active_ ? "text-primary" : "text-gray-400"}`} />
                  {t(item.labelKey)}
                  {active_ && <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary/60" />}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div className="px-3 pb-2 border-t border-gray-100 pt-3">
          <LanguageSwitcher />
        </div>

        {/* Return to site link */}
        <div className="px-3 pb-2">
          <Link href="/">
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <Home className="h-4 w-4 text-gray-400" />
              {t("portal.back_to_site")}
            </a>
          </Link>
        </div>

        {/* User + Logout */}
        <div className="border-t border-gray-100 px-3 py-3 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            {guest?.avatar_url ? (
              <img src={guest.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-xs text-gray-400 truncate">{guest?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("portal.log_out")}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 flex items-center justify-between px-4 h-14 shadow-sm">
        <Link href="/">
          <img src={logoMark} alt={APP_NAME} className="h-8 w-auto" />
        </Link>
        <span className="text-sm font-semibold text-gray-700">{t("portal.my_portal")}</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-orange-50 transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <img src={logoHorizontal} alt={APP_NAME} className="h-7 w-auto" />
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
              <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                {t("portal.my_portal")}
              </p>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active_ = isActive(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => { setLocation(item.href); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active_
                        ? "bg-orange-50 text-primary"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active_ ? "text-primary" : "text-gray-400"}`} />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </nav>
            <div className="px-3 pb-2 border-t border-gray-100 pt-3">
              <LanguageSwitcher />
            </div>
            <div className="px-3 pb-2">
              <button
                onClick={() => { setLocation("/"); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Home className="h-4 w-4 text-gray-400" />
                {t("portal.back_to_site")}
              </button>
            </div>
            <div className="border-t border-gray-100 px-3 py-3">
              <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
                {guest?.avatar_url ? (
                  <img src={guest.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{guest?.email ?? ""}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("portal.log_out")}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  );
}
