import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useListSuburbs, useDeleteSuburb, getListSuburbsQueryKey } from "@workspace/api-client-react";
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

export default function SuburbList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [state, setState] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: suburbs, isLoading } = useListSuburbs(
    { search: search || undefined, country_code: countryCode || undefined, state: state || undefined },
    { query: { queryKey: getListSuburbsQueryKey({ search: search || undefined, country_code: countryCode || undefined, state: state || undefined }) } }
  );

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(suburbs ?? []);
  const pagination = usePagination(sorted);

  const deleteMutation = useDeleteSuburb({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const pageIds = pagination.paginatedItems.map((s) => s.id);
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
      const res = await apiFetch("/api/v1/suburbs/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() });
      toast({ title: permanent ? `${data.affected} suburbs permanently deleted` : `${data.affected} suburbs archived` });
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
        title={t("nav.suburb")}
        subtitle={`${suburbs?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/suburbs/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("suburb.new") || `${t("common.new")} ${t("nav.suburb")}`}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("suburb.search_placeholder") || t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={countryCode || "_all"} onValueChange={(v) => setCountryCode(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder={t("suburb.label_country") || "Country"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("suburb.all_countries") || "All Countries"}</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="NZ">New Zealand</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t("suburb.state_filter_placeholder") || "State filter..."}
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-32 h-8 text-sm"
          />
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
                <SortableTh sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_name")}</SortableTh>
                <SortableTh sortKey="area_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_area")}</SortableTh>
                <SortableTh sortKey="state" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_state")}</SortableTh>
                <SortableTh sortKey="country_code" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_country")}</SortableTh>
                <SortableTh sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_status")}</SortableTh>
                <SortableTh sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("suburb.col_created")}</SortableTh>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
              ) : suburbs?.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("suburb.no_records") || "No suburbs found"}</td></tr>
              ) : (
                pagination.paginatedItems.map((suburb) => (
                  <tr key={suburb.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(suburb.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && (
                      <td className="px-3 py-3">
                        <Checkbox checked={selectedIds.has(suburb.id)} onCheckedChange={() => toggleSelect(suburb.id)} aria-label="Select suburb" onClick={(e) => e.stopPropagation()} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/property/suburbs/${suburb.id}`} className="hover:underline text-primary">{suburb.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{suburb.area_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{suburb.state ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{suburb.country_code}</td>
                    <td className="px-4 py-3"><StatusBadge status={suburb.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(suburb.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/property/suburbs/${suburb.id}`}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(suburb.id)}>
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
            <AlertDialogTitle>{t("suburb.delete_title") || t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("suburb.delete_desc") || t("common.cannot_undo")}</AlertDialogDescription>
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
              {bulkAction === "permanent" ? "Permanently Delete Suburbs" : "Archive Suburbs"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} suburb(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} suburb(s). They will be hidden from view.`}
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
