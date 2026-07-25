import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListContracts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useSortableData } from "@/components/ui/SortableTable";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Signed: "bg-purple-100 text-purple-700",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-orange-100 text-orange-700",
  Terminated: "bg-red-100 text-red-700",
};

export default function ContractList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: contracts } = useListContracts({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
  });

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(contracts ?? []);
  const pagination = usePagination(sorted);

  const pageIds = pagination.paginatedItems.map((c) => c.id);
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
      const res = await apiFetch("/api/v1/contracts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: permanent ? `${data.affected} contracts permanently deleted` : `${data.affected} contracts archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("nav.contract")}</h1>
            <p className="text-sm text-muted-foreground">{contracts?.length ?? 0} {t("common.total")}</p>
          </div>
          <Link href="/contracts/contracts/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("contract.new")}</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("contract.search_placeholder")}
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("contract.all_statuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract.all_statuses")}</SelectItem>
              <SelectItem value="Draft">{t("contract.status_draft")}</SelectItem>
              <SelectItem value="Sent">{t("contract.status_sent")}</SelectItem>
              <SelectItem value="Signed">{t("contract.status_signed")}</SelectItem>
              <SelectItem value="Active">{t("contract.status_active")}</SelectItem>
              <SelectItem value="Expired">{t("contract.status_expired")}</SelectItem>
              <SelectItem value="Terminated">{t("contract.status_terminated")}</SelectItem>
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
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuperAdmin && <TableHead className="w-10"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></TableHead>}
                <TableHead sortKey="contract_ref" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_ref")}</TableHead>
                <TableHead sortKey="tenant_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_tenant")}</TableHead>
                <TableHead sortKey="space_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_space")}</TableHead>
                <TableHead sortKey="contract_product_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_product")}</TableHead>
                <TableHead sortKey="start_date" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_start")}</TableHead>
                <TableHead sortKey="end_date" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_end")}</TableHead>
                <TableHead sortKey="weekly_rate" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_weekly_rate")}</TableHead>
                <TableHead sortKey="total_rent" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_total_rent")}</TableHead>
                <TableHead sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract.col_status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!contracts || contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 10 : 9} className="text-center text-muted-foreground py-12">
                    {t("contract.no_contracts")}
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedItems.map(c => (
                <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-primary/5" : ""}>
                  {isSuperAdmin && <TableCell><Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} onClick={(e) => e.stopPropagation()} /></TableCell>}
                  <TableCell>
                    <Link href={`/contracts/contracts/${c.id}`} className="text-primary hover:underline font-medium font-mono">
                      {c.contract_ref}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.tenant_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.space_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.contract_product_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.start_date ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.end_date ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {c.weekly_rate != null ? `$${c.weekly_rate}/wk` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.total_rent != null ? `$${c.total_rent.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[c.status] ?? "bg-gray-100 text-gray-700"}>
                      {t(`contract.status_${c.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Contracts" : "Archive Contracts"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} contract(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} contract(s). They will be hidden from view.`}
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
