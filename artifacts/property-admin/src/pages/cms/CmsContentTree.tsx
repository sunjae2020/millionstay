import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Globe,
  Lock,
  Newspaper,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useCmsSites, pageDisplayTitle } from "./useCmsSites";

// The CMS content tree — every site's pages, blog and blog categories in one
// column, so content is navigated where it lives instead of through separate
// sidebar entries that gave no sense of which site a page belonged to.

interface TreePage {
  id: number;
  site_key: string;
  slug: string;
  title: string | null;
  locales?: { locale: string; title?: string | null }[];
  status: string;
  is_home: boolean;
  legacy_page_key: string | null;
}

export function CmsContentTree({ onCreatePage }: { onCreatePage: (siteKey: string) => void }) {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const { sites } = useCmsSites();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: pages = [] } = useQuery<TreePage[]>({
    queryKey: ["cms-pages", "tree"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/cms/pages");
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json();
    },
  });

  const bySite = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, TreePage[]>();
    for (const page of pages) {
      const label = `${page.title ?? ""} ${(page.locales ?? []).map((l) => l.title ?? "").join(" ")} ${page.slug}`;
      if (q && !label.toLowerCase().includes(q)) continue;
      const list = map.get(page.site_key) ?? [];
      list.push(page);
      map.set(page.site_key, list);
    }
    return map;
  }, [pages, search]);

  const searching = search.trim().length > 0;

  return (
    <aside className="w-64 shrink-0 border-r bg-muted/20 flex flex-col h-[calc(100vh-var(--header-h,4rem))] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("cms.content")}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title={t("cms.new_page")}
          onClick={() => onCreatePage(sites[0]?.site_key ?? "")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("cms.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-3">
        {sites.map((site) => {
          const sitePages = bySite.get(site.site_key) ?? [];
          const isCollapsed = !searching && collapsed[site.site_key];
          return (
            <div key={site.site_key}>
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [site.site_key]: !prev[site.site_key] }))}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium hover:bg-muted"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 text-left truncate">{site.label || site.site_key}</span>
                <span className="text-xs text-muted-foreground">{sitePages.length}</span>
              </button>

              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {sitePages.map((page) => (
                    <TreeItem
                      key={page.id}
                      href={`/cms/pages/${page.id}`}
                      active={location === `/cms/pages/${page.id}`}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      label={pageDisplayTitle(page, i18n.language) || t("cms.untitled")}
                      muted={page.status !== "Published"}
                      // A built-in page is a code route: its address cannot move.
                      trailing={page.legacy_page_key ? <Lock className="h-3 w-3 opacity-40" /> : null}
                    />
                  ))}

                  {/* The blog lives with the site whose pages it sits beside. */}
                  <TreeItem
                    href={`/cms/blog?site=${site.site_key}`}
                    active={location.startsWith("/cms/blog") && !location.includes("categories")}
                    icon={<Newspaper className="h-3.5 w-3.5" />}
                    label={t("cms.blog_tab_posts")}
                  />
                  <TreeItem
                    href={`/cms/blog-categories?site=${site.site_key}`}
                    active={location.startsWith("/cms/blog-categories")}
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label={t("cms.blog_tab_categories")}
                  />
                </div>
              )}
            </div>
          );
        })}

        {sites.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("cms.pages_empty")}</p>
        )}
      </nav>
    </aside>
  );
}

function TreeItem({
  href,
  active,
  icon,
  label,
  muted,
  trailing,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  muted?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md pl-7 pr-2 py-1.5 text-sm transition-colors ${
        active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground/80"
      }`}
    >
      <span className={active ? "" : "text-muted-foreground"}>{icon}</span>
      <span className={`flex-1 truncate ${muted && !active ? "text-muted-foreground" : ""}`}>{label}</span>
      {trailing}
    </Link>
  );
}
