import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";

export interface CmsSite {
  site_key: string;
  label: string;
  host: string | null;
  locales: string[];
  default_locale: string;
  is_active: boolean;
}

/**
 * The site registry, shared by every CMS screen. Labels and hosts are TENANT
 * facts stored in the DB (seeded per instance by scripts/seed-cms-sites.mjs,
 * editable in CMS → Pages → site settings) — never hardcoded, so an instance
 * always shows its own brand and domain rather than another tenant's.
 *
 * Inactive sites are excluded unless `includeInactive` is set, so a
 * development-only instance never offers a guest site it does not run. The
 * selection persists in localStorage across CMS screens.
 */
export function useCmsSites(options: { includeInactive?: boolean } = {}) {
  const includeInactive = options.includeInactive ?? false;

  const { data: sites = [], isLoading } = useQuery<CmsSite[]>({
    queryKey: ["cms-sites", includeInactive],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cms/sites${includeInactive ? "?all=1" : ""}`);
      if (!res.ok) throw new Error("Failed to load sites");
      const rows = await res.json();
      return rows.map((row: CmsSite) => ({
        ...row,
        locales: Array.isArray(row.locales) ? row.locales : ["en"],
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const [stored, setStored] = useState(() => localStorage.getItem("cms.site") ?? "");
  // A stored key that is no longer active must not strand the user on a site
  // that isn't in the list.
  const valid = sites.some((s) => s.site_key === stored);
  const siteKey = (valid ? stored : "") || sites[0]?.site_key || "";
  const activeSite = sites.find((s) => s.site_key === siteKey);

  function setSiteKey(key: string) {
    localStorage.setItem("cms.site", key);
    setStored(key);
  }

  return { sites, siteKey, setSiteKey, activeSite, isLoading };
}

/**
 * A page's name in the language the admin is being read in, falling back to the
 * page's own title. A Korean-speaking editor should not have to read "For
 * Owners" for a page called 소유주 안내.
 */
export function pageDisplayTitle(
  page: { title: string | null; slug: string; locales?: { locale: string; title?: string | null }[] },
  uiLanguage: string,
): string {
  const lang = (uiLanguage || "en").split("-")[0];
  const localised = page.locales?.find((l) => l.locale === lang)?.title?.trim();
  return localised || page.title?.trim() || page.slug;
}
