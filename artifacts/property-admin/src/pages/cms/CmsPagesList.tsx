import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Globe, Layers } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { useCmsSites } from "./useCmsSites";

// The CMS pages register. Every public page of every site lives here; the
// per-locale bodies are edited in the builder (/cms/pages/:id).

interface LocaleSummary {
  locale: string;
  status: string;
  blocks: number;
}

interface CmsPage {
  id: number;
  site_key: string;
  slug: string;
  title: string | null;
  render_mode: string;
  status: string;
  is_home: boolean;
  sort_order: number;
  updated_at: string;
  legacy_page_key: string | null;
  locales: LocaleSummary[];
}

const STATUS_COLORS: Record<string, string> = {
  Published: "bg-green-100 text-green-700",
  Draft: "bg-gray-100 text-gray-600",
  Archived: "bg-red-100 text-red-600",
};

export default function CmsPagesList() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { sites, siteKey, setSiteKey, activeSite } = useCmsSites();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", slug: "" });

  const { data: pages = [], isLoading } = useQuery<CmsPage[]>({
    queryKey: ["cms-pages", siteKey, search, status, showDeleted],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (siteKey) qs.set("site", siteKey);
      if (search) qs.set("q", search);
      if (status !== "_all") qs.set("status", status);
      if (showDeleted) qs.set("deleted", "only");
      const res = await apiFetch(`/api/v1/cms/pages?${qs}`);
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json();
    },
  });

  const createPage = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/cms/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_key: siteKey,
          title: draft.title,
          slug: draft.slug || draft.title,
          render_mode: "blocks",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create page");
      return res.json();
    },
    onSuccess: (page: CmsPage) => {
      setCreateOpen(false);
      setDraft({ title: "", slug: "" });
      qc.invalidateQueries({ queryKey: ["cms-pages"] });
      navigate(`/cms/pages/${page.id}`);
    },
    onError: (err: Error) => toast({ title: t("cms.create_failed"), description: err.message, variant: "destructive" }),
  });

  const columns: ColumnDef<CmsPage>[] = useMemo(
    () => [
      {
        key: "title",
        header: "cms.col_name",
        hideable: false,
        defaultWidth: 300,
        cell: (page) => (
          <div className="font-medium">
            <Link href={`/cms/pages/${page.id}`} className="text-primary hover:underline line-clamp-1">
              {page.title || page.slug || t("cms.untitled")}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              /{page.slug}
              {page.is_home && <span className="ml-2">— {t("cms.home_page")}</span>}
            </p>
          </div>
        ),
      },
      {
        key: "render_mode",
        header: "cms.col_mode",
        defaultWidth: 120,
        cell: (page) =>
          page.render_mode === "blocks" ? (
            <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">{t("cms.mode_blocks")}</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t("cms.mode_legacy")}</Badge>
          ),
      },
      {
        key: "locales",
        header: "cms.col_locales",
        defaultWidth: 220,
        cell: (page) => {
          const published = page.locales.filter((l) => l.status === "Published").length;
          const total = activeSite?.locales.length ?? page.locales.length;
          return (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">
                {published}/{total}
              </span>
              {page.locales.map((l) => (
                <Badge
                  key={l.locale}
                  variant="outline"
                  className={`text-[10px] px-1 py-0 ${l.status === "Published" ? "border-green-400 text-green-700" : "text-muted-foreground"}`}
                >
                  {l.locale}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        key: "status",
        header: "common.status",
        defaultWidth: 110,
        cell: (page) => (
          <Badge className={`${STATUS_COLORS[page.status] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
            {page.status}
          </Badge>
        ),
      },
      {
        key: "updated_at",
        header: "cms.col_updated",
        defaultWidth: 130,
        cell: (page) => <span className="text-sm text-muted-foreground">{formatDate(page.updated_at)}</span>,
      },
    ],
    [t, activeSite],
  );

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Globe className="h-5 w-5" />
            {t("cms.pages_title")}
          </>
        }
        subtitle={t("cms.pages_subtitle", { count: pages.length })}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("cms.new_page")}
          </Button>
        }
      />

      <div className="p-6">
        <SiteSwitcher sites={sites} value={siteKey} onChange={setSiteKey} />

        <DataTable
          tableKey="cms-pages"
          columns={columns}
          data={pages}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyText={
            <div className="flex flex-col items-center gap-3">
              <Layers className="h-8 w-8 text-muted-foreground/40" />
              <span>{t("cms.pages_empty")}</span>
            </div>
          }
          selection={{
            enable: true,
            resource: "cms/pages",
            onChanged: () => qc.invalidateQueries({ queryKey: ["cms-pages"] }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("cms.search_pages")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("cms.all_status")}</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cms.new_page")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("cms.field_title")}</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={t("cms.field_title_placeholder")}
              />
            </div>
            <div>
              <Label>{t("cms.field_slug")}</Label>
              <Input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="about-us"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("cms.field_slug_hint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => createPage.mutate()} disabled={!draft.title || createPage.isPending}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

export function SiteSwitcher({
  sites,
  value,
  onChange,
}: {
  sites: { site_key: string; label: string; host: string | null }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { t } = useTranslation();
  if (sites.length === 0) return null;
  return (
    <div className="mb-4 inline-flex rounded-lg border bg-muted/30 p-1">
      {sites.map((site) => (
        <button
          key={site.site_key}
          onClick={() => onChange(site.site_key)}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            value === site.site_key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t(`cms.site_${site.site_key}`, { defaultValue: site.label })}</span>
          {site.host && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
              {site.host.replace(/^https?:\/\//, "")}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
