import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { APP_NAME } from "../lib/appName";

import enTranslations from "../locales/en/translation.json";
import koTranslations from "../locales/ko/translation.json";
import zhTranslations from "../locales/zh/translation.json";
import jaTranslations from "../locales/ja/translation.json";
import thTranslations from "../locales/th/translation.json";
import viTranslations from "../locales/vi/translation.json";

const resources = {
  en: { translation: enTranslations },
  ko: { translation: koTranslations },
  zh: { translation: zhTranslations },
  ja: { translation: jaTranslations },
  th: { translation: thTranslations },
  vi: { translation: viTranslations },
};

const SUPPORTED = new Set(["en", "ko", "zh", "ja", "th", "vi"]);

function detectBrowserLanguage(): string {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const code = lang.split("-")[0].toLowerCase();
    if (SUPPORTED.has(code)) return code;
  }
  return "en";
}

const savedLanguage = localStorage.getItem("ms_admin_language");
const initialLanguage = savedLanguage && SUPPORTED.has(savedLanguage)
  ? savedLanguage
  : detectBrowserLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
      // White-label: translation strings use {{appName}} instead of a hardcoded
      // brand; filled from VITE_APP_NAME (defaults to MillionStay).
      defaultVariables: { appName: APP_NAME },
    },
  });

/* ─── DB-managed overrides ────────────────────────────────────────────────
   The bundled JSON above is the source of truth for admin copy. On top of it we
   overlay whatever an editor has saved under the `admin.` namespace in the
   translations table (Content → Page Translations → Admin Console), so wording
   can be corrected per tenant without a redeploy. Failures are swallowed — the
   console keeps working on the bundled strings if the API is unreachable. */

function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!;
      if (typeof node[p] !== "object" || node[p] === null) node[p] = {};
      node = node[p] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]!] = v;
  }
  return out;
}

const overlaidLangs = new Set<string>();

export async function loadDbTranslations(lng: string): Promise<void> {
  if (!lng || overlaidLangs.has(lng)) return;
  overlaidLangs.add(lng);
  try {
    const res = await fetch(`/api/v1/public/translations/${encodeURIComponent(lng)}?prefix=admin.`);
    if (!res.ok) { overlaidLangs.delete(lng); return; }
    const json = await res.json();
    const flat: Record<string, string> = json?.data ?? {};
    if (flat && Object.keys(flat).length > 0) {
      i18n.addResourceBundle(lng, "translation", unflatten(flat), true, true);
      if (lng === i18n.language) void i18n.changeLanguage(lng);
    }
  } catch {
    overlaidLangs.delete(lng);
  }
}

void loadDbTranslations(i18n.language);
i18n.on("languageChanged", (lng) => void loadDbTranslations(lng));

export default i18n;
