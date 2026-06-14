import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { HS } from "@/lib/homestay-theme";

// Language switcher for the Million Homestay site. Mirrors the main-site switcher
// (components/navbar.tsx): it fetches the admin-managed language list from
// /api/v1/public/languages and drives i18next + the ms_language preference, so
// the bundled-default + DB-overlay translation pipeline applies to the homestay
// pages too.
type LangOption = { code: string; label: string; iso: string; name: string };

const FALLBACK_LANGUAGES: LangOption[] = [
  { code: "en", label: "EN", iso: "au", name: "English" },
  { code: "ko", label: "KO", iso: "kr", name: "한국어" },
  { code: "zh", label: "ZH", iso: "cn", name: "中文" },
  { code: "ja", label: "JA", iso: "jp", name: "日本語" },
  { code: "th", label: "TH", iso: "th", name: "ภาษาไทย" },
  { code: "vi", label: "VI", iso: "vn", name: "Tiếng Việt" },
];

function FlagIcon({ iso, size = 18 }: { iso: string; size?: number }) {
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

export function HomestayLanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const [languages, setLanguages] = useState<LangOption[]>(FALLBACK_LANGUAGES);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBase()}/api/v1/public/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const rows = json?.data;
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        setLanguages(
          rows.map((l: any) => ({
            code: l.code,
            label: String(l.code).toUpperCase(),
            iso: l.flag_iso || l.code,
            name: l.name || l.english_name || l.code,
          })),
        );
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const change = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("ms_language", code);
    setOpen(false);
  };

  const current = languages.find((l) => l.code === i18n.language) ?? languages[0] ?? FALLBACK_LANGUAGES[0]!;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        style={{ color: HS.darkBrown }}
        aria-label="Change language"
      >
        <FlagIcon iso={current.iso} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-50">
          {languages.map((lang) => {
            const isActive = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => change(lang.code)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                style={{ color: isActive ? HS.brand : HS.darkBrown, fontWeight: isActive ? 600 : 400 }}
              >
                <FlagIcon iso={lang.iso} />
                <span>{lang.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
