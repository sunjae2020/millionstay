import { useState } from "react";
import { Link } from "wouter";
import { formatDate as fmtDate } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Archive, Trash2, X, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { TablePagination, usePagination } from "@/components/ui/TablePagination";

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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [site, setSite] = useState("guest");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts", search, status],
    queryFn: () => fetchBlogPosts({
      search,
      status: status !== "_all" ? status : "",
    }),
  });

  const sitePosts = posts.filter((p: any) =>
    site === "homestay" ? p.category === HOMESTAY_CATEGORY : p.category !== HOMESTAY_CATEGORY,
  );
  const pagination = usePagination(sitePosts);
  const pageIds = pagination.paginatedItems.map((p: any) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id: number) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id: number) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id: number) => n.delete(id)); return n; });
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id: number) => n.add(id)); return n; });
    }
  };
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async (permanent: boolean) => {
    setIsBulkLoading(true);
    setBulkAction(null);
    try {
      const res = await apiFetch("/api/v1/blog-posts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({ title: permanent ? t("blog.posts_permanently_deleted", { count: data.affected }) : t("blog.posts_archived", { count: data.affected }) });
      clearSelection();
    } catch (err: any) {
      toast({ title: t("blog.error"), description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  function formatDate(dateStr: string | null) {
    return fmtDate(dateStr);
  }

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
              onClick={() => { setSite(s.id); clearSelection(); }}
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

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200">
            <span className="text-sm font-medium text-orange-800">{t("blog.posts_selected", { count: selectedIds.size })}</span>
            <button onClick={clearSelection} className="text-orange-500 hover:text-orange-700"><X className="h-3.5 w-3.5" /></button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                <Archive className="h-3.5 w-3.5" /> {t("blog.archive_selected")}
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5" onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> {t("blog.delete_forever")}
              </Button>
            </div>
          </div>
        )}

        <div className="border rounded-lg bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuperAdmin && <TableHead className="w-10"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></TableHead>}
                <TableHead>{t("blog.col_title")}</TableHead>
                <TableHead>{t("blog.col_category")}</TableHead>
                <TableHead>{t("blog.col_author")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("blog.col_published")}</TableHead>
                <TableHead>{t("blog.col_created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : sitePosts.length === 0 ? (
                <TableRow><TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                    <span>{t("blog.empty_title")} <Link href="/content/blog/new" className="text-[#E8621A] hover:underline">{t("blog.create_first")}</Link></span>
                  </div>
                </TableCell></TableRow>
              ) : pagination.paginatedItems.map((post: any) => (
                <TableRow key={post.id} className={`hover:bg-muted/30 cursor-pointer ${selectedIds.has(post.id) ? "bg-orange-50/50" : ""}`}>
                  {isSuperAdmin && <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(post.id); }}><Checkbox checked={selectedIds.has(post.id)} onCheckedChange={() => toggleSelect(post.id)} /></TableCell>}
                  <TableCell className="font-medium">
                    <Link href={`/content/blog/${post.id}`} className="text-[#E8621A] hover:underline line-clamp-1">
                      {post.title}
                    </Link>
                    {post.excerpt && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{post.excerpt}</p>}
                  </TableCell>
                  <TableCell>
                    {post.category ? <Badge variant="outline" className="text-xs">{post.category}</Badge> : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{post.author || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[post.status] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
                      {STATUS_LABEL_KEYS[post.status] ? t(STATUS_LABEL_KEYS[post.status]) : post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(post.published_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(post.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? t("blog.permanently_delete_posts") : t("blog.archive_posts")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? t("blog.confirm_permanent_delete", { count: selectedIds.size })
                : t("blog.confirm_archive", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant={bulkAction === "permanent" ? "destructive" : "outline"}
              className={bulkAction !== "permanent" ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
              onClick={() => handleBulkDelete(bulkAction === "permanent")}>
              {bulkAction === "permanent" ? t("blog.delete_forever") : t("blog.archive_all")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
