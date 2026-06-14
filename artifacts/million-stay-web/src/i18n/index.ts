import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getApiBase } from "../lib/api-base";

import enTranslations from "../locales/en/translation.json";
import koTranslations from "../locales/ko/translation.json";
import zhTranslations from "../locales/zh/translation.json";
import jaTranslations from "../locales/ja/translation.json";
import thTranslations from "../locales/th/translation.json";
import viTranslations from "../locales/vi/translation.json";

// Bundled defaults — used immediately (no flash) and as an offline fallback.
// Admin-managed values from the database are overlaid on top after load.
const resources = {
  en: { translation: enTranslations },
  ko: { translation: koTranslations },
  zh: { translation: zhTranslations },
  ja: { translation: jaTranslations },
  th: { translation: thTranslations },
  vi: { translation: viTranslations },
};

const SUPPORTED_LANGS = ["en", "ko", "zh", "ja", "th", "vi"] as const;

// Resolve a browser/OS language tag (e.g. "ko-KR", "zh-Hans-CN") to a supported
// locale. Returns null when there's no match.
function matchSupported(tag: string | undefined | null): string | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split("-")[0];
  return SUPPORTED_LANGS.find((l) => l === base) ?? null;
}

// First visit → follow the device/OS language (navigator.languages, in
// preference order). Once the user picks a language manually it's saved to
// localStorage and that choice wins on every later visit.
function getInitialLanguage(): string {
  const saved = localStorage.getItem("ms_language");
  if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) return saved;

  const candidates =
    typeof navigator !== "undefined"
      ? [...(navigator.languages ?? []), navigator.language]
      : [];
  for (const tag of candidates) {
    const match = matchSupported(tag);
    if (match) return match;
  }
  return "en";
}

const savedLanguage = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

// Convert a flat dot-notation map ({ "nav.links.search": "..." }) into the
// nested structure i18next expects.
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

// Fetch DB-managed translations for a language and overlay them on top of the
// bundled defaults. Failures are swallowed — the bundled JSON keeps the site
// working offline / if the API is unreachable.
export async function loadDbTranslations(lng: string): Promise<void> {
  if (!lng || overlaidLangs.has(lng)) return;
  overlaidLangs.add(lng);
  try {
    const res = await fetch(`${getApiBase()}/api/v1/public/translations/${encodeURIComponent(lng)}`);
    if (!res.ok) { overlaidLangs.delete(lng); return; }
    const json = await res.json();
    const flat: Record<string, string> = json?.data ?? {};
    if (flat && Object.keys(flat).length > 0) {
      i18n.addResourceBundle(lng, "translation", unflatten(flat), true, true);
      // Force consumers to re-render with the freshly overlaid strings.
      if (lng === i18n.language) i18n.changeLanguage(lng);
    }
  } catch {
    overlaidLangs.delete(lng);
  }
}

void loadDbTranslations(i18n.language);
i18n.on("languageChanged", (lng) => void loadDbTranslations(lng));

export default i18n;
