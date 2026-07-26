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

// Posts are split per public site by category: the homestay site shows only
// "Homestay"-category posts (kept off the guest blog); the guest site shows
// everything else.
const HOMESTAY_CATEGORY = "Homestay";
const BLOG_SITES = [
  { id: "guest", label: "Guest Site", host: "www.millionstay.com" },
  { id: "homestay", label: "Homestay", host: "homestay.millionstay.com" },
];

async function fetchBlogPosts(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  const res = await apiFetch(`/api/v1/blog-posts?${qs}`);
  if (!res.ok) throw new Error("Failed to load blog posts");
  const json = await res.json();
  return json.data ?? [];
}

export default function BlogList() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [site, setSite] = useState("guest");
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts", search, status, showDeleted],
    queryFn: () => fetchBlogPosts({
      search,
      status: status !== "_all" ? status : "",
      ...(showDeleted ? { deleted: "only" } : {}),
    }),
  });

  const sitePosts = posts.filter((p: any) =>
    site === "homestay" ? p.category === HOMESTAY_CATEGORY : p.category !== HOMESTAY_CATEGORY,
  );

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
        cell: (post) => (
          <div className="font-medium">
            <Link href={`/content/blog/${post.id}`} className="text-primary hover:underline line-clamp-1">
              {post.title}
            </Link>
            {post.excerpt && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{post.excerpt}</p>}
          </div>
        ),
      },
      {
        key: "category",
        header: "blog.col_category",
        cell: (post) =>
          post.category ? <Badge variant="outline" className="text-xs">{post.category}</Badge> : <span className="text-muted-foreground/40">—</span>,
      },
      {
        key: "author",
        header: "blog.col_author",
        cell: (post) => <span className="text-sm text-muted-foreground">{post.author || "—"}</span>,
      },
      {
        key: "status",
        header: "common.status",
        cell: (post) => (
          <Badge className={`${STATUS_COLORS[post.status] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
            {STATUS_LABEL_KEYS[post.status] ? t(STATUS_LABEL_KEYS[post.status]) : post.status}
          </Badge>
        ),
      },
      {
        key: "published_at",
        header: "blog.col_published",
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

  return (
    <Layout>
      <PageHeader
        title={<><FileText className="h-5 w-5" />{t("blog.title")}</>}
        subtitle={t("blog.posts_total", { count: sitePosts.length })}
        actions={
          <Link href={site === "homestay" ? `/content/blog/new?category=${encodeURIComponent(HOMESTAY_CATEGORY)}` : "/content/blog/new"}>
            <Button><Plus className="h-4 w-4 mr-2" />{t("blog.new_post")}</Button>
          </Link>
        }
      />

      <div className="p-6">
        {/* Site switcher — Guest (www) and Homestay blogs are managed separately
            (split by the "Homestay" category). */}
        <div className="mb-4 inline-flex rounded-lg border bg-muted/30 p-1">
          {BLOG_SITES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSite(s.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                site === s.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t(`blog.site_${s.id}`, { defaultValue: s.label })}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{s.host}</Badge>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
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

        <DataTable
          tableKey="blog-posts"
          columns={columns}
          data={sitePosts}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyText={
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <span>{t("blog.empty_title")} <Link href="/content/blog/new" className="text-primary hover:underline">{t("blog.create_first")}</Link></span>
            </div>
          }
          selection={{
            enable: true,
            resource: "blog-posts",
            onChanged: () => qc.invalidateQueries({ queryKey: ["blog-posts"] }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
        />
      </div>
    </Layout>
  );
}
