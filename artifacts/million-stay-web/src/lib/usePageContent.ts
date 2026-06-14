import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiBase } from "./api-base";

const BASE = getApiBase();

// Overlay CMS-managed page copy (property-admin → "Website Pages") on top of the
// built-in i18n defaults. The admin saves content keyed by a site-namespaced
// page key (e.g. "homestay-home") + language; this hook reads it back from the
// public endpoint. An empty/missing field falls back to the i18n string, so the
// site renders exactly as before until an editor fills a field in.
//
// Usage:
//   const pc = usePageContent("homestay-home");
//   pc("hero_title", t("homestay.home.hero_title"))
export function usePageContent(pageKey: string): (field: string, fallback: string) => string {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0];

  const { data } = useQuery({
    queryKey: ["public-page-content", pageKey, lang],
    queryFn: async (): Promise<Record<string, string>> => {
      try {
        const res = await fetch(`${BASE}/api/v1/public/page-contents/${pageKey}/${lang}`);
        if (!res.ok) return {};
        const json = await res.json();
        return (json?.content ?? {}) as Record<string, string>;
      } catch {
        return {};
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const content = data ?? {};
  return (field: string, fallback: string): string => {
    const v = content[field];
    return v != null && String(v).trim() !== "" ? v : fallback;
  };
}
