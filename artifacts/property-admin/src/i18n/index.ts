import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslations from "../locales/en/translation.json";
import koTranslations from "../locales/ko/translation.json";
import zhTranslations from "../locales/zh/translation.json";
import jaTranslations from "../locales/ja/translation.json";
import thTranslations from "../locales/th/translation.json";

const resources = {
  en: { translation: enTranslations },
  ko: { translation: koTranslations },
  zh: { translation: zhTranslations },
  ja: { translation: jaTranslations },
  th: { translation: thTranslations },
};

const savedLanguage = localStorage.getItem("ms_admin_language") || "en";

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

export default i18n;
