import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, Plus, Search, Pencil, Copy, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useListPromotions } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Scheduled: "bg-yellow-100 text-yellow-700",
  Expired: "bg-gray-100 text-gray-700",
  Disabled: "bg-red-100 text-red-700",
  Draft: "bg-slate-100 text-slate-600",
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
const FREQ_LABELS: Record<string, string> = {
  Weekly: "Weekly",
  Biweekly: "Biweekly",
  Monthly: "Monthly",
};

function formatDiscount(promo: { promotion_type: string; discount_percentage?: number | null; discount_amount?: number | null; free_nights?: number | null }) {
  if (promo.promotion_type === "Percentage" && promo.discount_percentage != null) return `${promo.discount_percentage}%`;
  if (promo.promotion_type === "Fixed" && promo.discount_amount != null) return `$${promo.discount_amount.toFixed(0)}`;
  if (promo.promotion_type === "FreeNights" && promo.free_nights != null) return `${promo.free_nights} nights`;
  if (promo.promotion_type === "None") return "—";
  return "—";
}

function stayRange(promo: { min_stay_weeks?: number | null; max_stay_weeks?: number | null }) {
  const min = promo.min_stay_weeks;
  const max = promo.max_stay_weeks;
  if (min != null && max != null) return `${min}–${max}w`;
  if (min != null && max == null) return `${min}w+`;
  return "—";
}

export default function PromotionList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("_all");
  const [termType, setTermType] = useState("_all");
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  async function handleClone(p: any) {
    setCloningId(p.id);
    try {
      const { id: _id, created_at, updated_at, code, ...rest } = p;
      const res = await apiFetch("/api/v1/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, name: `Copy of ${p.name}`, status: "Draft", code: null }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const cloned = await res.json();
      navigate(`/products/promotions/${cloned.id}`);
    } finally {
      setCloningId(null);
    }
  }

  const { data: promotions = [], isLoading } = useListPromotions({
    search: search || undefined,
    status: status !== "_all" ? status : undefined,
    promotion_type: termType !== "_all" ? undefined : undefined,
  });

  const filtered = termType !== "_all" ? promotions.filter(p => p.term_type === termType) : promotions;
  const pagination = usePagination(filtered);

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
      const res = await apiFetch("/api/v1/promotions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast({ title: permanent ? `${data.affected} promotions permanently deleted` : `${data.affected} promotions archived` });
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
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">{t("nav.promotion")}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? t("common.loading") : `${filtered.length} ${t("nav.promotion")}`}
            </p>
          </div>
          <Link href="/products/promotions/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("common.new")} {t("nav.promotion")}</Button>
          </Link>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("promotion.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={termType} onValueChange={setTermType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("promotion.all_terms")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("promotion.all_terms")}</SelectItem>
              <SelectItem value="ShortTerm">{t("promotion.term_short")}</SelectItem>
              <SelectItem value="MidTerm">{t("promotion.term_mid")}</SelectItem>
              <SelectItem value="LongTerm">{t("promotion.term_long")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t("promotion.all_statuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("promotion.all_statuses")}</SelectItem>
              <SelectItem value="Draft">{t("promotion.status_draft")}</SelectItem>
              <SelectItem value="Scheduled">{t("promotion.status_scheduled")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Expired">{t("promotion.status_expired")}</SelectItem>
              <SelectItem value="Disabled">{t("promotion.status_disabled")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200">
            <span className="text-sm font-medium text-orange-800">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button onClick={clearSelection} className="text-orange-500 hover:text-orange-700"><X className="h-3.5 w-3.5" /></button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
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
                  <TableHead>{t("promotion.col_name")}</TableHead>
                  <TableHead>{t("promotion.col_term")}</TableHead>
                  <TableHead>{t("promotion.col_discount")}</TableHead>
                  <TableHead>{t("promotion.col_stay")}</TableHead>
                  <TableHead>{t("promotion.col_billing")}</TableHead>
                  <TableHead>{t("promotion.col_code")}</TableHead>
                  <TableHead>{t("promotion.col_status")}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={isSuperAdmin ? 9 : 8} className="text-center text-muted-foreground py-12">{t("common.loading")}</TableCell></TableRow>
                ) : pagination.paginatedItems.length === 0 ? (
                  <TableRow><TableCell colSpan={isSuperAdmin ? 9 : 8} className="text-center text-muted-foreground py-12">{t("promotion.no_promotions")}</TableCell></TableRow>
                ) : pagination.paginatedItems.map((p) => (
                  <TableRow key={p.id} className={`hover:bg-muted/30 ${selectedIds.has(p.id) ? "bg-orange-50/50" : ""}`}>
                    {isSuperAdmin && <TableCell><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} onClick={(e) => e.stopPropagation()} /></TableCell>}
                    <TableCell className="font-medium">
                      <Link href={`/products/promotions/${p.id}`} className="text-[#E8621A] hover:underline">{p.name}</Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={TERM_COLORS[p.term_type] ?? "bg-gray-100 text-gray-600"}>{TERM_LABELS[p.term_type] ?? p.term_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold">{formatDiscount(p)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{stayRange(p)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{FREQ_LABELS[p.billing_frequency ?? ""] ?? (p.billing_frequency ?? "—")}</TableCell>
                    <TableCell>
                      {p.code ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p.code}</code> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/products/promotions/${p.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          disabled={cloningId === p.id}
                          onClick={() => handleClone(p)}
                          title="Clone promotion"
                        >
                          <Copy className={`h-3.5 w-3.5 ${cloningId === p.id ? "animate-pulse" : ""}`} />
                        </Button>
                      </div>
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
              {bulkAction === "permanent" ? "Permanently Delete Promotions" : "Archive Promotions"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} promotion(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} promotion(s). They will be hidden from view.`}
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
