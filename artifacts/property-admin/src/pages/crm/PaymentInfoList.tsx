import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useListPaymentInfo, useDeletePaymentInfo, getListPaymentInfoQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, AlertTriangle, X, Archive, Loader2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

export default function PaymentInfoList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();

  const params = { search: search || undefined, payment_type: typeFilter || undefined };
  const { data: records, isLoading } = useListPaymentInfo(params, {
    query: { queryKey: getListPaymentInfoQueryKey(params) },
  });

  const pagination = usePagination(records ?? []);

  const archiveMutation = useDeletePaymentInfo({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setIsPermanentDeleting(true);
    try {
      await apiFetch(`/api/v1/payment-info/${deleteId}?permanent=true`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
      setDeleteId(null);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const pageIds = pagination.paginatedItems.map((r) => r.id);
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
      const res = await apiFetch("/api/v1/payment-info/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
      toast({ title: permanent ? `${data.affected} records permanently deleted` : `${data.affected} records archived` });
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
        title={t("nav.payment_info")}
        subtitle={`${records?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/crm/payment-info/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("payment_info.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("payment_info.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter || "__all"} onValueChange={(v) => setTypeFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder={t("payment_info.payment_type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("payment_info.all_types")}</SelectItem>
              <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
              <SelectItem value="Stripe">Stripe</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium text-primary">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button onClick={clearSelection} className="text-primary hover:text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                <Archive className="h-3.5 w-3.5" /> Archive Selected
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5"
                onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Forever
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {isSuperAdmin && (
                    <th className="px-3 py-2.5 w-8">
                      <Checkbox
                        checked={allPageSelected}
                        data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("payment_info.col_name")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("payment_info.col_type")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("payment_info.col_bank_account")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("payment_info.col_status")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagination.paginatedItems.map((r) => (
                  <tr key={r.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(r.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && (
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                          aria-label={`Select ${r.name}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/payment-info/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.payment_type}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.bank_name && <span>{r.bank_name}</span>}
                      {r.bsb_number && <span className="ml-1 text-xs">BSB {r.bsb_number}</span>}
                      {r.account_number && <span className="ml-1 text-xs">· {r.account_number}</span>}
                      {r.stripe_account_id && <span className="text-xs font-mono">{r.stripe_account_id}</span>}
                      {!r.bank_name && !r.stripe_account_id && <span>—</span>}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/payment-info/${r.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!records || records.length === 0) && (
                  <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">{t("payment_info.no_records")}</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {isSuperAdmin ? "Delete Payment Info" : "Archive Payment Info"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperAdmin
                ? "Choose how to remove this record. Archiving hides it from view but keeps the data. Permanent deletion cannot be undone."
                : "This payment info will be archived and hidden from view. A Super Admin can restore it if needed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isSuperAdmin ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => deleteId && archiveMutation.mutate({ id: deleteId })}
              disabled={archiveMutation.isPending}>
              Archive
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={isPermanentDeleting}>
                Delete Forever
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Records" : "Archive Records"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} payment info record(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} payment info record(s). They will be hidden from view.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant={bulkAction === "permanent" ? "destructive" : "outline"}
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
