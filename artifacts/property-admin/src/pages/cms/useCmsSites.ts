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
 * The site registry, shared by every CMS screen. The selected site is kept in
 * localStorage so switching between Pages / Blog / Design does not reset it.
 */
export function useCmsSites() {
  const { data: sites = [], isLoading } = useQuery<CmsSite[]>({
    queryKey: ["cms-sites"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/cms/sites");
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
  const siteKey = stored || sites[0]?.site_key || "";
  const activeSite = sites.find((s) => s.site_key === siteKey);

  function setSiteKey(key: string) {
    localStorage.setItem("cms.site", key);
    setStored(key);
  }

  return { sites, siteKey, setSiteKey, activeSite, isLoading };
}
