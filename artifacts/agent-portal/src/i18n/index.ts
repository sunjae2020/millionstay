import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en/translation.json";
import ko from "@/locales/ko/translation.json";
import zh from "@/locales/zh/translation.json";
import ja from "@/locales/ja/translation.json";
import th from "@/locales/th/translation.json";

const STORAGE_KEY = "ms_agent_language";
const SUPPORTED = ["en", "ko", "zh", "ja", "th"];

function detectLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
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
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on("languageChanged", (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng); } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = lng;
});

export default i18n;
