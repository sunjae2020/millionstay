import { useMemo, useState } from "react";
import { Link } from "wouter";
import { formatDate as fmtDate } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useCmsSites } from "@/pages/cms/useCmsSites";
import { SiteSwitcher } from "@/pages/cms/CmsPagesList";

const STATUS_COLORS: Record<string, string> = {
  Published: "bg-green-100 text-green-700",
  Draft: "bg-gray-100 text-gray-600",
  Archived: "bg-red-100 text-red-600",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  Published: "blog.status_published",
  Draft: "blog.status_draft",
  Archived: "blog.status_archived",
};

// Each public site runs its own blog. Posts carry `site_key` (www | homestay |
// dev); the historical "Homestay category" split was migrated into it by 0037.

async function fetchBlogPosts(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  const res = await apiFetch(`/api/v1/blog-posts?${qs}`);
  if (!res.ok) throw new Error("Failed to load blog posts");
  const json = await res.json();
  return json.data ?? [];
}

export default function BlogList({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const { sites, siteKey, setSiteKey } = useCmsSites();
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts", search, status, showDeleted],
    queryFn: () => fetchBlogPosts({
      search,
      status: status !== "_all" ? status : "",
      ...(showDeleted ? { deleted: "only" } : {}),
    }),
  });

  const sitePosts = posts.filter((p: any) => (p.site_key ?? "www") === siteKey);

  function formatDate(dateStr: string | null) {
    return fmtDate(dateStr);
  }

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "title",
        header: "blog.col_title",
        hideable: false,
        defaultWidth: 320,
        editable: { type: "text", getValue: (post) => post.title },
        cell: (post) => (
          <div className="font-medium">
            <Link href={`/cms/blog/${post.id}`} className="text-primary hover:underline line-clamp-1">
              {post.title}
            </Link>
            {post.excerpt && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{post.excerpt}</p>}
          </div>
        ),
      },
      {
        key: "category",
        header: "blog.col_category",
        editable: { type: "text", getValue: (post) => post.category ?? "" },
        cell: (post) =>
          post.category ? <Badge variant="outline" className="text-xs">{post.category}</Badge> : <span className="text-muted-foreground/40">—</span>,
      },
      {
        key: "author",
        header: "blog.col_author",
        editable: { type: "text", getValue: (post) => post.author ?? "" },
        cell: (post) => <span className="text-sm text-muted-foreground">{post.author || "—"}</span>,
      },
      {
        key: "status",
        header: "common.status",
        editable: {
          type: "select",
          getValue: (post) => post.status,
          options: [
            { value: "Draft", label: t("blog.status_draft") },
            { value: "Published", label: t("blog.status_published") },
            { value: "Archived", label: t("blog.status_archived") },
          ],
        },
        cell: (post) => (
          <Badge className={`${STATUS_COLORS[post.status] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
            {STATUS_LABEL_KEYS[post.status] ? t(STATUS_LABEL_KEYS[post.status]) : post.status}
          </Badge>
        ),
      },
      {
        key: "published_at",
        header: "blog.col_published",
        editable: { type: "date", getValue: (post) => (post.published_at ? String(post.published_at).slice(0, 10) : "") },
        cell: (post) => <span className="text-sm text-muted-foreground">{formatDate(post.published_at)}</span>,
      },
      {
        key: "created_at",
        header: "blog.col_created",
        cell: (post) => <span className="text-sm text-muted-foreground">{formatDate(post.created_at)}</span>,
      },
    ],
    [t],
  );

  const Shell = embedded ? EmbeddedShell : Layout;

  return (
    <Shell>
      <PageHeader
        title={<><FileText className="h-5 w-5" />{t("blog.title")}</>}
        subtitle={t("blog.posts_total", { count: sitePosts.length })}
        actions={
          <Link href={`/cms/blog/new?site=${encodeURIComponent(siteKey)}`}>
            <Button><Plus className="h-4 w-4 mr-2" />{t("blog.new_post")}</Button>
          </Link>
        }
      />

      <div className="p-6">
        <SiteSwitcher sites={sites} value={siteKey} onChange={setSiteKey} />

        <DataTable
          tableKey="blog-posts"
          columns={columns}
          data={sitePosts}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyText={
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <span>{t("blog.empty_title")} <Link href={`/cms/blog/new?site=${siteKey}`} className="text-primary hover:underline">{t("blog.create_first")}</Link></span>
            </div>
          }
          selection={{
            enable: true,
            resource: "blog-posts",
            onChanged: () => qc.invalidateQueries({ queryKey: ["blog-posts"] }),
          }}
          editing={{ resource: "blog-posts", onEdited: () => qc.invalidateQueries({ queryKey: ["blog-posts"] }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("blog.search_posts")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("blog.all_status")}</SelectItem>
                  <SelectItem value="Draft">{t("blog.status_draft")}</SelectItem>
                  <SelectItem value="Published">{t("blog.status_published")}</SelectItem>
                  <SelectItem value="Archived">{t("blog.status_archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>
    </Shell>
  );
}

// Rendered inside the CMS blog tabs, the sidebar chrome comes from the parent.
function EmbeddedShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
