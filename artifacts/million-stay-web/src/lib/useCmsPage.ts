import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiBase } from "./api-base";
import { normaliseBody, resolveTokens, type Block, type DesignTokens } from "@workspace/cms-blocks";

const BASE = getApiBase();

export interface CmsPageData {
  slug: string;
  locale: string;
  title: string | null;
  seo: { title: string | null; description: string | null; keywords: string | null; image: string | null };
  blocks: Block[];
  tokens: DesignTokens;
}

/**
 * Load a published block page for the current language.
 *
 * Returns `null` when the page is not (yet) a block page — that is the normal
 * case during the migration, and the caller keeps its existing hardcoded
 * rendering. Only pages an editor has flipped to block mode return content.
 */
export function useCmsPage(siteKey: string, slug: string): CmsPageData | null {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0];

  const { data } = useQuery({
    queryKey: ["cms-page", siteKey, slug, lang],
    queryFn: async (): Promise<CmsPageData | null> => {
      try {
        const path = slug === "" ? "-" : slug;
        const res = await fetch(`${BASE}/api/v1/public/cms/pages/${siteKey}/${path}?lang=${lang}`);
        if (!res.ok) return null;
        const json = await res.json();
        return {
          slug: json.slug,
          locale: json.locale,
          title: json.title ?? null,
          seo: json.seo ?? { title: null, description: null, keywords: null, image: null },
          blocks: normaliseBody(json.body).blocks,
          tokens: resolveTokens(json.tokens),
        };
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return data ?? null;
}

/** Apply a block page's SEO to the document head. No-op when there is none. */
export function useCmsSeo(page: CmsPageData | null, fallbackTitle?: string): void {
  const title = page?.seo.title;
  const description = page?.seo.description;
  const keywords = page?.seo.keywords;

  useEffect(() => {
    if (title?.trim()) document.title = title.trim();
    else if (fallbackTitle) document.title = fallbackTitle;
    upsertMeta("description", description ?? null);
    upsertMeta("keywords", keywords ?? null);
  }, [title, description, keywords, fallbackTitle]);
}

function upsertMeta(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (!value || !value.trim()) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}
