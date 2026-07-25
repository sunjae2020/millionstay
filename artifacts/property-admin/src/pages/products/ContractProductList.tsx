import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListContractProducts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Tag, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useSortableData } from "@/components/ui/SortableTable";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-700",
};
const TERM_COLORS: Record<string, string> = {
  ShortTerm: "bg-sky-100 text-sky-700",
  MidTerm: "bg-violet-100 text-violet-700",
  LongTerm: "bg-amber-100 text-amber-700",
};
const TERM_LABELS: Record<string, string> = {
  ShortTerm: "Short-term",
  MidTerm: "Mid-term",
  LongTerm: "Long-term",
};

const PRODUCT_TYPES = ["Room", "Suite", "Apartment", "House", "Studio", "Service"];

export default function ContractProductList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [productType, setProductType] = useState("_all");
  const [termType, setTermType] = useState("_all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: products } = useListContractProducts({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    product_type: productType === "_all" ? undefined : productType,
  });

  const filtered = termType !== "_all" ? (products ?? []).filter(p => p.term_type === termType) : (products ?? []);
  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const pagination = usePagination(sorted);

  const pageIds = pagination.paginatedItems.map((p) => p.id);
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
      const res = await apiFetch("/api/v1/contract-products/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["contract-products"] });
      toast({ title: permanent ? `${data.affected} products permanently deleted` : `${data.affected} products archived` });
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
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{t("nav.contract_product")}</h1>
              <p className="text-sm text-muted-foreground">{filtered.length} {t("nav.products")}</p>
            </div>
          </div>
          <Link href="/products/contract-products/new">
            <Button className="bg-primary hover:bg-[#d4561a] text-white"><Plus className="h-4 w-4 mr-2" />{t("common.new")} {t("nav.products")}</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("contract_product.search_placeholder")} value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={termType} onValueChange={setTermType}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("contract_product.all_terms")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract_product.all_terms")}</SelectItem>
              <SelectItem value="ShortTerm">{t("contract_product.term_short")}</SelectItem>
              <SelectItem value="MidTerm">{t("contract_product.term_mid")}</SelectItem>
              <SelectItem value="LongTerm">{t("contract_product.term_long")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("contract_product.all_statuses")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract_product.all_statuses")}</SelectItem>
              <SelectItem value="Draft">{t("contract_product.status_draft")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
              <SelectItem value="Archived">{t("contract_product.status_archived")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("contract_product.all_types")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("contract_product.all_types")}</SelectItem>
              {PRODUCT_TYPES.map(t_val => <SelectItem key={t_val} value={t_val}>{t_val}</SelectItem>)}
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
                  <TableHead sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_name")}</TableHead>
                  <TableHead sortKey="term_type" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_term")}</TableHead>
                  <TableHead sortKey="space_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_space")}</TableHead>
                  <TableHead sortKey="promotion_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_promotion")}</TableHead>
                  <TableHead sortKey="weekly_rate" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_weekly_rate")}</TableHead>
                  <TableHead sortKey="effective_weekly_rate" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_eff_rate")}</TableHead>
                  <TableHead sortKey="billing_frequency" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_billing")}</TableHead>
                  <TableHead sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("contract_product.col_status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 9 : 8} className="text-center text-muted-foreground py-12">{t("contract_product.no_products")}</TableCell>
                  </TableRow>
                ) : pagination.paginatedItems.map(p => (
                  <TableRow key={p.id} className={`hover:bg-muted/30 ${selectedIds.has(p.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && <TableCell><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} onClick={(e) => e.stopPropagation()} /></TableCell>}
                    <TableCell className="font-medium">
                      <Link href={`/products/contract-products/${p.id}`} className="text-primary hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.product_type}</div>
                    </TableCell>
                    <TableCell>
                      {p.term_type ? (
                        <Badge className={`${TERM_COLORS[p.term_type] ?? "bg-gray-100 text-gray-600"} text-[10px] px-1.5 py-0`}>
                          {TERM_LABELS[p.term_type] ?? p.term_type}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.space_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.promotion_name ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Tag className="h-3 w-3" />{p.promotion_name}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {p.weekly_rate != null ? `$${p.weekly_rate.toFixed(0)}/wk` : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold text-primary">
                      {p.effective_weekly_rate != null && p.effective_weekly_rate !== p.weekly_rate
                        ? `$${p.effective_weekly_rate.toFixed(0)}/wk`
                        : (p.weekly_rate != null ? `$${p.weekly_rate.toFixed(0)}/wk` : "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.billing_frequency ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>
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
              {bulkAction === "permanent" ? "Permanently Delete Products" : "Archive Products"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} product(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} product(s). They will be hidden from view.`}
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
