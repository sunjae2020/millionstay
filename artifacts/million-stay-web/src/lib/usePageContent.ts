import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiBase } from "./api-base";

const BASE = getApiBase();

interface PageContentData {
  content: Record<string, string>;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
}

const EMPTY: PageContentData = { content: {}, seo_title: null, seo_description: null, seo_keywords: null };

// Shared fetch of a CMS page row (property-admin → "Website Pages") for the
// current language. The admin saves content keyed by a site-namespaced page key
// (e.g. "homestay-home") + language; this reads it back from the public
// endpoint. react-query dedupes so usePageContent + useHomestaySeo share one
// request per (pageKey, lang).
function usePageContentData(pageKey: string): PageContentData {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0];

  const { data } = useQuery({
    queryKey: ["public-page-content", pageKey, lang],
    queryFn: async (): Promise<PageContentData> => {
      try {
        const res = await fetch(`${BASE}/api/v1/public/page-contents/${pageKey}/${lang}`);
        if (!res.ok) return EMPTY;
        const json = await res.json();
        return {
          content: (json?.content ?? {}) as Record<string, string>,
          seo_title: json?.seo_title ?? null,
          seo_description: json?.seo_description ?? null,
          seo_keywords: json?.seo_keywords ?? null,
        };
      } catch {
        return EMPTY;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return data ?? EMPTY;
}

// Overlay CMS-managed page copy on top of the built-in i18n defaults. An empty
// or missing field falls back to the i18n string, so the site renders exactly
// as before until an editor fills a field in.
//
//   const pc = usePageContent("homestay-home");
//   pc("hero_title", t("homestay.home.hero_title"))
export function usePageContent(pageKey: string): (field: string, fallback: string) => string {
  const { content } = usePageContentData(pageKey);
  return (field: string, fallback: string): string => {
    const v = content[field];
    return v != null && String(v).trim() !== "" ? v : fallback;
  };
}

function upsertMeta(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (!value || !value.trim()) return; // leave any existing tag untouched when CMS is empty
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

// Apply CMS-managed SEO (title + meta description/keywords) to the document
// head. Falls back to the provided title when the CMS has no seo_title. The
// page calling this is the parent of HomestayLayout, so this effect runs after
// the layout's own title effect and wins.
export function useHomestaySeo(pageKey: string, opts: { titleFallback?: string } = {}): void {
  const { seo_title, seo_description, seo_keywords } = usePageContentData(pageKey);
  const { titleFallback } = opts;

  useEffect(() => {
    const title = (seo_title && seo_title.trim())
      ? seo_title.trim()
      : (titleFallback ? `${titleFallback} — Million Homestay` : null);
    if (title) document.title = title;
    upsertMeta("description", seo_description);
    upsertMeta("keywords", seo_keywords);
  }, [seo_title, seo_description, seo_keywords, titleFallback]);
}
