import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useListAccounts, useDeleteAccount, getListAccountsQueryKey } from "@workspace/api-client-react";
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

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Guest: "bg-blue-100 text-blue-700 border-blue-200",
  SpaceOwner: "bg-purple-100 text-purple-700 border-purple-200",
  Broker: "bg-teal-100 text-teal-700 border-teal-200",
  Manager: "bg-cyan-100 text-cyan-700 border-cyan-200",
  RealEstateAgent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ServiceHost: "bg-orange-100 text-orange-700 border-orange-200",
  Partner: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export default function AccountList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();

  const params = { search: search || undefined, account_type: typeFilter || undefined, status: statusFilter || undefined };
  const { data: accounts, isLoading } = useListAccounts(params, {
    query: { queryKey: getListAccountsQueryKey(params) },
  });

  const pagination = usePagination(accounts ?? []);

  const archiveMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setIsPermanentDeleting(true);
    try {
      await apiFetch(`/api/v1/accounts/${deleteId}?permanent=true`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      setDeleteId(null);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const pageIds = pagination.paginatedItems.map((a) => a.id);
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
      const res = await apiFetch("/api/v1/accounts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      toast({ title: permanent ? `${data.affected} accounts permanently deleted` : `${data.affected} accounts archived` });
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
        title={t("nav.account")}
        subtitle={`${accounts?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/crm/accounts/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("account.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("account.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter || "__all"} onValueChange={(v) => setTypeFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder={t("account.account_type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("account.all_types")}</SelectItem>
              {Object.keys(ACCOUNT_TYPE_COLORS).map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("account.all_statuses")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
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
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_name")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_type")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_primary_contact")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_email")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_status")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagination.paginatedItems.map((a) => (
                  <tr key={a.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(a.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && (
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selectedIds.has(a.id)}
                          onCheckedChange={() => toggleSelect(a.id)}
                          aria-label={`Select ${a.name}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-xs ${ACCOUNT_TYPE_COLORS[a.account_type] ?? "bg-gray-100 text-gray-700"}`}>
                        {a.account_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{(a as any).primary_contact_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.account_email ?? "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/accounts/${a.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!accounts || accounts.length === 0) && (
                  <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">{t("account.no_accounts")}</td></tr>
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
              {isSuperAdmin ? "Delete Account" : "Archive Account"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperAdmin
                ? "Choose how to remove this account. Archiving hides it from view but keeps the data. Permanent deletion cannot be undone."
                : "This account will be archived and hidden from view. A Super Admin can restore it if needed."}
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
              {bulkAction === "permanent" ? "Permanently Delete Accounts" : "Archive Accounts"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} account(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} account(s). They will be hidden from view.`}
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
