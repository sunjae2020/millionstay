import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useListSpaceOptions,
  useDeleteSpaceOption,
  getListSpaceOptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Archive, X, AlertTriangle, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/date";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useSortableData, SortableTh } from "@/components/ui/SortableTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

export default function SpaceOptionList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: options, isLoading } = useListSpaceOptions(
    { search: search || undefined },
    { query: { queryKey: getListSpaceOptionsQueryKey({ search: search || undefined }) } }
  );

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(options ?? []);
  const pagination = usePagination(sorted);

  const deleteMutation = useDeleteSpaceOption({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const pageIds = pagination.paginatedItems.map((o) => o.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n; });
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
      const res = await apiFetch("/api/v1/space-options/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
      toast({ title: permanent ? `${data.affected} space options permanently deleted` : `${data.affected} space options archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t("nav.space_options")}
        subtitle={`${options?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/space-options/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("space_option.new") || `${t("common.new")} ${t("nav.space_option")}`}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("space_option.search_placeholder") || t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium text-primary">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button onClick={clearSelection} className="text-primary hover:text-primary"><X className="h-3.5 w-3.5" /></button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                <Archive className="h-3.5 w-3.5" /> Archive Selected
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5" onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Forever
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {isSuperAdmin && (
                  <th className="px-3 py-3 w-8">
                    <Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                  </th>
                )}
                <SortableTh sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space_option.col_name")}</SortableTh>
                <SortableTh sortKey="display_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space_option.col_display_name")}</SortableTh>
                <SortableTh sortKey="category" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space_option.col_category")}</SortableTh>
                <SortableTh sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space_option.col_status")}</SortableTh>
                <SortableTh sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space_option.col_created")}</SortableTh>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
              ) : options?.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("space_option.no_records") || "No space options found"}</td></tr>
              ) : (
                pagination.paginatedItems.map((opt) => (
                  <tr key={opt.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(opt.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && (
                      <td className="px-3 py-3">
                        <Checkbox checked={selectedIds.has(opt.id)} onCheckedChange={() => toggleSelect(opt.id)} aria-label="Select option" onClick={(e) => e.stopPropagation()} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/property/space-options/${opt.id}`} className="hover:underline text-primary">{opt.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{opt.display_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{opt.category ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={opt.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(opt.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/property/space-options/${opt.id}`}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(opt.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space_option.delete_title") || t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space_option.delete_desc") || t("common.cannot_undo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Space Options" : "Archive Space Options"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} space option(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} space option(s). They will be hidden from view.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant={bulkAction === "permanent" ? "destructive" : "outline"}
              className={bulkAction !== "permanent" ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
              onClick={() => handleBulkDelete(bulkAction === "permanent")}>
              {bulkAction === "permanent" ? "Delete Forever" : "Archive All"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
