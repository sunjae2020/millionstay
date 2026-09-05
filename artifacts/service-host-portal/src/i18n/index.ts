import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en/translation.json";
import ko from "@/locales/ko/translation.json";
import zh from "@/locales/zh/translation.json";
import ja from "@/locales/ja/translation.json";
import th from "@/locales/th/translation.json";
import vi from "@/locales/vi/translation.json";
import { APP_NAME } from "@/lib/appName";

const STORAGE_KEY = "ms_service_host_language";
const SUPPORTED = ["en", "ko", "zh", "ja", "th", "vi"];

// White-label instances run in one working language: a Korean tenant's portal opens in
// 한국어 regardless of the browser locale. `VITE_DEFAULT_DOC_LANG` (mirrors the server's
// DEFAULT_DOC_LANG and property-admin's behaviour) wins over browser detection; an explicit
// user choice via the language switcher still wins over both. Unset (MillionStay) keeps the
// previous browser-detect behaviour.
const TENANT_LANGUAGE = (import.meta.env.VITE_DEFAULT_DOC_LANG ?? "").toLowerCase().slice(0, 2);

function detectLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
  if (SUPPORTED.includes(TENANT_LANGUAGE)) return TENANT_LANGUAGE;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED.includes(nav) ? nav : "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
    zh: { translation: zh },
    ja: { translation: ja },
    th: { translation: th },
    vi: { translation: vi },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
    // White-label: translation strings use {{appName}} instead of a hardcoded
    // brand; filled from VITE_APP_NAME (defaults to MillionStay). Spec §2.3.
    defaultVariables: { appName: APP_NAME },
  },
  returnNull: false,
});

i18n.on("languageChanged", (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng); } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = lng;
});

export default i18n;
