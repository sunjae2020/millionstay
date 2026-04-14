import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Archive, Calendar, Package, Zap, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-yellow-100 text-yellow-700",
  Archived: "bg-red-100 text-red-600",
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  one_time:  { label: "One-time",  color: "bg-blue-100 text-blue-700",   icon: Zap },
  scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-700", icon: Calendar },
  physical:  { label: "Physical",  color: "bg-amber-100 text-amber-700",  icon: Package },
};

async function fetchServices(q?: string, service_type?: string, status?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (service_type) params.set("service_type", service_type);
  if (status) params.set("status", status);
  const res = await apiFetch(`/api/v1/services?${params}`);
  if (!res.ok) throw new Error("Failed to fetch services");
  return res.json();
}

async function archiveService(id: number) {
  const res = await apiFetch(`/api/v1/services/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to archive");
  return res.json();
}

export default function ServiceList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["services", q, typeFilter, statusFilter],
    queryFn: () => fetchServices(
      q || undefined,
      typeFilter !== "_all" ? typeFilter : undefined,
      statusFilter !== "_all" ? statusFilter : undefined,
    ),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => archiveService(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      setArchiveId(null);
    },
  });

  const rows: any[] = data?.data ?? [];
  const pagination = usePagination(rows);

  const pageIds = pagination.paginatedItems.map((s: any) => s.id);
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
      const res = await apiFetch("/api/v1/services/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["services"] });
      toast({ title: permanent ? `${result.affected} services permanently deleted` : `${result.affected} services archived` });
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
        title={t("nav.service_product")}
        subtitle={`${rows.length} ${t("nav.service")}`}
        actions={
          <Link href="/services/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("common.new")} {t("nav.service")}</Button>
          </Link>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("service.search_placeholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("service.all_types")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("service.all_types")}</SelectItem>
              <SelectItem value="one_time">{t("service.type_one_time")}</SelectItem>
              <SelectItem value="scheduled">{t("service.type_scheduled")}</SelectItem>
              <SelectItem value="physical">{t("service.type_physical")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("service.all_statuses")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("service.all_statuses")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
              <SelectItem value="Archived">{t("service.status_archived")}</SelectItem>
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
        {/* Table */}
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {isSuperAdmin && (
                    <th className="px-3 py-3 w-8">
                      <Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_name")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_type")}</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_price")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_billing")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_optional")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_refundable")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("service.col_status")}</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground">{t("service.no_services")}</td></tr>
                ) : pagination.paginatedItems.map((s: any) => {
                  const typeConf = TYPE_CONFIG[s.service_type] ?? { label: s.service_type, color: "bg-gray-100 text-gray-600", icon: Zap };
                  const Icon = typeConf.icon;
                  const TRIGGER_LABELS: Record<string, string> = {
                    at_booking: t("service.trigger_at_booking"),
                    at_checkout: t("service.trigger_at_checkout"),
                    on_request: t("service.trigger_on_request"),
                  };
                  return (
                    <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(s.id) ? "bg-orange-50/50" : ""}`}>
                      {isSuperAdmin && (
                        <td className="px-3 py-3">
                          <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} aria-label="Select service" onClick={(e) => e.stopPropagation()} />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/services/${s.id}`} className="text-[#E8621A] hover:underline">
                          {s.name}
                        </Link>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs gap-1 ${typeConf.color}`}>
                          <Icon className="h-3 w-3" />{t(`service.type_${s.service_type}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {s.base_price != null ? `$${Number(s.base_price).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {TRIGGER_LABELS[s.billing_trigger] ?? s.billing_trigger}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={s.is_optional ? "text-gray-400" : "text-[#E8621A] font-medium"}>
                          {s.is_optional ? t("common.optional") : t("common.required")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={s.is_refundable ? "text-green-600 font-medium" : "text-gray-400"}>
                          {s.is_refundable ? t("common.yes") : t("common.no")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${STATUS_COLORS[s.status] ?? ""}`}>{t(`common.${s.status.toLowerCase()}`)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/services/${s.id}`}>
                            <button className="p-1.5 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </Link>
                          <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setArchiveId(s.id)}>
                            <Archive className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={archiveId !== null} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("service.archive_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("service.archive_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => archiveId && archiveMutation.mutate(archiveId)}>
              {t("service.btn_archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Services" : "Archive Services"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} service(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} service(s). They will be hidden from view.`}
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
