import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useListWorkOrders } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useSortableData, SortableTh } from "@/components/ui/SortableTable";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  PendingReview: "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

const priorityColors: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-orange-50 text-primary",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

export default function WorkOrderList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [priority, setPriority] = useState("_all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: workOrdersRaw = [] } = useListWorkOrders({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    priority: priority === "_all" ? undefined : priority,
  });

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(workOrdersRaw);
  const pagination = usePagination(sorted);

  const pageIds = pagination.paginatedItems.map((wo) => wo.id);
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
      const res = await apiFetch("/api/v1/work-orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast({ title: permanent ? `${data.affected} work orders permanently deleted` : `${data.affected} work orders archived` });
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
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.work_order")}</h1>
            <p className="text-sm text-muted-foreground">{workOrdersRaw.length} {t("common.total")}</p>
          </div>
          <Button onClick={() => navigate("/maintenance/work-orders/new")}>
            <Plus className="h-4 w-4 mr-1" />
            {t("workorder.new")}
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Input
              placeholder={t("workorder.search_placeholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-4"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("workorder.all_statuses")}</SelectItem>
              <SelectItem value="Open">{t("workorder.status_open")}</SelectItem>
              <SelectItem value="InProgress">{t("workorder.status_in_progress")}</SelectItem>
              <SelectItem value="PendingReview">{t("workorder.status_pending_review")}</SelectItem>
              <SelectItem value="Completed">{t("workorder.status_completed")}</SelectItem>
              <SelectItem value="Cancelled">{t("workorder.status_closed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("workorder.all_priorities")}</SelectItem>
              <SelectItem value="Low">{t("workorder.priority_low")}</SelectItem>
              <SelectItem value="Normal">{t("workorder.priority_normal")}</SelectItem>
              <SelectItem value="High">{t("workorder.priority_high")}</SelectItem>
              <SelectItem value="Urgent">{t("workorder.priority_urgent")}</SelectItem>
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
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {isSuperAdmin && <th className="px-3 py-3 w-8"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></th>}
                <SortableTh sortKey="order_ref" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_ref")}</SortableTh>
                <SortableTh sortKey="title" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_title")}</SortableTh>
                <SortableTh sortKey="property_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_property")}</SortableTh>
                <SortableTh sortKey="space_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_space")}</SortableTh>
                <SortableTh sortKey="category" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_category")}</SortableTh>
                <SortableTh sortKey="assigned_contact_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_assigned")}</SortableTh>
                <SortableTh sortKey="priority" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_priority")}</SortableTh>
                <SortableTh sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_status")}</SortableTh>
              </tr>
            </thead>
            <tbody>
              {workOrdersRaw.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">{t("workorder.no_workorders")}</td></tr>
              )}
              {pagination.paginatedItems.map((wo) => (
                <tr
                  key={wo.id}
                  className={`border-b last:border-0 hover:bg-muted/20 cursor-pointer ${selectedIds.has(wo.id) ? "bg-primary/5" : ""}`}
                  onClick={() => navigate(`/maintenance/work-orders/${wo.id}`)}
                >
                  {isSuperAdmin && <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(wo.id)} onCheckedChange={() => toggleSelect(wo.id)} /></td>}
                  <td className="px-4 py-3 font-medium text-primary">{wo.order_ref}</td>
                  <td className="px-4 py-3 font-medium">{wo.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(wo as any).property_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(wo as any).space_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{wo.category ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(wo as any).assigned_contact_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[wo.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`workorder.priority_${wo.priority.toLowerCase()}` as any)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[wo.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {wo.status === "InProgress" ? t("workorder.status_in_progress") : wo.status === "PendingReview" ? t("workorder.status_pending_review") : t(`workorder.status_${wo.status.toLowerCase()}` as any)}
                    </span>
                  </td>
                </tr>
              ))}
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
              {bulkAction === "permanent" ? "Permanently Delete Work Orders" : "Archive Work Orders"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} work order(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} work order(s). They will be hidden from view.`}
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
