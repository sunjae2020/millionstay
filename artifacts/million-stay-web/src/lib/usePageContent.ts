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

/** Open Graph uses `property=`, not `name=` — a `name` tag is ignored by scrapers. */
function upsertMetaProperty(property: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (!value || !value.trim()) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** One canonical URL per page, so query strings do not read as duplicates. */
function upsertCanonical(href: string) {
  if (typeof document === "undefined" || !href) return;
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Apply a page's CMS-managed SEO (title + meta description/keywords) to the
 * document head, falling back to the page's own title when the CMS has no
 * seo_title. Runs after the layout's title effect, so it wins.
 *
 * `brand` is appended to the fallback title only — a seo_title authored in the
 * CMS is used verbatim, because an editor writing one has already decided how
 * the whole tag should read.
 */
export function usePageSeo(
  pageKey: string,
  opts: { titleFallback?: string; brand?: string } = {},
): void {
  const { content, seo_title, seo_description, seo_keywords } = usePageContentData(pageKey);
  const { titleFallback, brand } = opts;
  // Share cards need a picture; the page's own hero is the truest one available.
  const image = content["seo_image"] || content["hero_image_url"] || content["hero_1_image"] || "";

  useEffect(() => {
    const authored = seo_title?.trim();
    const fallback = titleFallback ? (brand ? `${titleFallback} — ${brand}` : titleFallback) : null;
    const title = authored || fallback;
    if (title) document.title = title;
    upsertMeta("description", seo_description);
    upsertMeta("keywords", seo_keywords);

    // Open Graph / Twitter — without these a shared link shows a bare URL.
    const url = typeof window !== "undefined" ? window.location.href.split("#")[0]! : "";
    upsertMetaProperty("og:type", "website");
    upsertMetaProperty("og:site_name", brand ?? null);
    upsertMetaProperty("og:title", title);
    upsertMetaProperty("og:description", seo_description);
    upsertMetaProperty("og:url", url);
    upsertMetaProperty("og:image", image || null);
    upsertMeta("twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("twitter:title", title);
    upsertMeta("twitter:description", seo_description);
    upsertMeta("twitter:image", image || null);
    upsertCanonical(url);
  }, [seo_title, seo_description, seo_keywords, image, titleFallback, brand]);
}

/** Homestay pages keep their existing call shape. */
export function useHomestaySeo(pageKey: string, opts: { titleFallback?: string } = {}): void {
  usePageSeo(pageKey, { ...opts, brand: "Million Homestay" });
}
