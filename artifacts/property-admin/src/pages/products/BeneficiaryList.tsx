import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListBeneficiaries,
  getListBeneficiariesQueryKey,
  useDeleteBeneficiary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Users, Archive, X, AlertTriangle, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useSortableData, SortableTh } from "@/components/ui/SortableTable";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-600",
  Archived: "bg-red-100 text-red-600",
};

const TYPE_COLORS: Record<string, string> = {
  Percentage: "bg-blue-100 text-blue-700",
  Fixed: "bg-amber-100 text-amber-700",
};

export default function BeneficiaryList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: beneficiaries, isLoading } = useListBeneficiaries(
    { q: q || undefined, status: statusFilter === "_all" ? undefined : statusFilter },
    { query: { queryKey: getListBeneficiariesQueryKey({ q: q || undefined }) } }
  );

  const deleteMutation = useDeleteBeneficiary({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const filtered = (beneficiaries ?? []).filter((b) => {
    if (typeFilter !== "_all" && b.commission_type !== typeFilter) return false;
    return true;
  });

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(filtered, {
    accessors: {
      rate: (b) =>
        b.commission_type === "Percentage"
          ? b.split_percentage != null
            ? Number(b.split_percentage)
            : null
          : b.fixed_amount != null
            ? Number(b.fixed_amount)
            : null,
    },
  });

  const pagination = usePagination(sorted);

  const pageIds = pagination.paginatedItems.map((b) => b.id);
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
      const res = await apiFetch("/api/v1/beneficiaries/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() });
      toast({ title: permanent ? `${data.affected} beneficiaries permanently deleted` : `${data.affected} beneficiaries archived` });
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
        title={t("nav.beneficiary")}
        subtitle={`${filtered.length} of ${beneficiaries?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/products/beneficiaries/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("common.new")} {t("nav.beneficiary")}
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("beneficiary.search_placeholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("beneficiary.all_types")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("beneficiary.all_types")}</SelectItem>
              <SelectItem value="Percentage">{t("beneficiary.type_percentage")}</SelectItem>
              <SelectItem value="Fixed">{t("beneficiary.type_fixed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t("beneficiary.all_statuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("beneficiary.all_statuses")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
              <SelectItem value="Archived">{t("beneficiary.status_archived")}</SelectItem>
            </SelectContent>
          </Select>
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
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {isSuperAdmin && <th className="px-3 py-3 w-8"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></th>}
                  <SortableTh sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_name")}</SortableTh>
                  <SortableTh sortKey="account_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_account")}</SortableTh>
                  <SortableTh sortKey="contract_product_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_product")}</SortableTh>
                  <SortableTh sortKey="commission_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_commission")}</SortableTh>
                  <SortableTh sortKey="commission_type" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_type")}</SortableTh>
                  <SortableTh sortKey="rate" align="right" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_rate")}</SortableTh>
                  <SortableTh sortKey="priority" align="center" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-20">{t("beneficiary.col_priority")}</SortableTh>
                  <SortableTh sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("beneficiary.col_status")}</SortableTh>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 10 : 9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">{t("beneficiary.no_beneficiaries")}</p>
                        <p className="text-xs">{t("beneficiary.no_beneficiaries_sub")}</p>
                        <Link href="/products/beneficiaries/new">
                          <Button size="sm" variant="outline">{t("beneficiary.add_first")}</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((b) => (
                    <tr key={b.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(b.id) ? "bg-primary/5" : ""}`}>
                      {isSuperAdmin && <td className="px-3 py-3"><Checkbox checked={selectedIds.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} onClick={(e) => e.stopPropagation()} /></td>}
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/products/beneficiaries/${b.id}`} className="text-primary hover:underline">
                          {b.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {b.account_name ?? <span className="italic opacity-50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {b.contract_product_name ?? <span className="italic opacity-50">All products</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {b.commission_name ?? <span className="italic opacity-50">Custom</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${TYPE_COLORS[b.commission_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.commission_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums font-semibold text-primary">
                        {b.commission_type === "Percentage"
                          ? b.split_percentage != null ? `${b.split_percentage}%` : "—"
                          : b.fixed_amount != null ? `$${Number(b.fixed_amount).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{b.priority ?? 1}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/products/beneficiaries/${b.id}`}>
                            <button className="p-1.5 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </Link>
                          <button
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                            onClick={() => setDeleteId(b.id)}
                          >
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

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Beneficiaries" : "Archive Beneficiaries"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} beneficiar${selectedIds.size > 1 ? "ies" : "y"}. This cannot be undone.`
                : `You are about to archive ${selectedIds.size} beneficiar${selectedIds.size > 1 ? "ies" : "y"}. They will be hidden from view.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant={bulkAction === "permanent" ? "destructive" : "outline"}
              className={bulkAction !== "permanent" ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
              onClick={() => handleBulkDelete(bulkAction === "permanent")}>
              {bulkAction === "permanent" ? "Delete Forever" : "Archive All"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("beneficiary.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("beneficiary.delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
