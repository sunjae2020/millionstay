import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListTasks, useUpdateTask, useCompleteTask, useDeleteTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, Play, Archive, X, AlertTriangle, Loader2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  Todo: "bg-gray-100 text-gray-700 border-gray-200",
  InProgress: "bg-blue-100 text-blue-700 border-blue-200",
  Done: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_DOTS: Record<string, string> = {
  Todo: "bg-gray-400",
  InProgress: "bg-blue-500",
  Done: "bg-green-500",
  Cancelled: "bg-red-400",
};

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_COLORS[priority] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{priority}</span>;
}

function TaskStatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  const dot = STATUS_DOTS[status] ?? "bg-gray-400";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status === "InProgress" ? "In Progress" : status}
    </span>
  );
}

export default function TaskList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = {
    search: search || undefined,
    task_status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    task_category: categoryFilter || undefined,
  };
  const { data: tasks, isLoading } = useListTasks(params, {
    query: { queryKey: getListTasksQueryKey(params) },
  });

  const pagination = usePagination(tasks ?? []);

  const deleteMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }),
    },
  });

  const completeMutation = useCompleteTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }),
    },
  });

  const pageIds = pagination.paginatedItems.map((t) => t.id);
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
      const res = await apiFetch("/api/v1/tasks/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: permanent ? `${data.affected} tasks permanently deleted` : `${data.affected} tasks archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  function handleStatusChange(id: number, newStatus: string) {
    if (newStatus === "Done") {
      completeMutation.mutate({ id }, {
        onSuccess: () => toast({ title: "Task completed" }),
        onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
      });
    } else {
      updateMutation.mutate({ id, data: { task_status: newStatus } }, {
        onSuccess: () => toast({ title: `Task moved to ${newStatus}` }),
        onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
      });
    }
  }

  const today = new Date().toISOString().split("T")[0]!;

  const totalTodo = tasks?.filter(t => t.task_status === "Todo").length ?? 0;
  const totalInProgress = tasks?.filter(t => t.task_status === "InProgress").length ?? 0;
  const totalOverdue = tasks?.filter(t => t.due_date && t.due_date < today && t.task_status !== "Done" && t.task_status !== "Cancelled").length ?? 0;
  const totalDoneThisMonth = tasks?.filter(t => t.task_status === "Done" && t.completed_at?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length ?? 0;

  return (
    <Layout>
      <PageHeader
        title={t("nav.task")}
        subtitle={`${tasks?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/sales/tasks/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("task.new")}</Button>
          </Link>
        }
      />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("task.status_todo"), value: totalTodo, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
            { label: t("task.status_in_progress"), value: totalInProgress, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: t("dashboard.overdue_tasks"), value: totalOverdue, color: "text-red-600", bg: "bg-red-50 border-red-200" },
            { label: t("workorder.completed_work_orders"), value: totalDoneThisMonth, color: "text-green-600", bg: "bg-green-50 border-green-200" },
          ].map(card => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.bg}`}>
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("task.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("task.all_statuses")}</SelectItem>
              <SelectItem value="Todo">{t("task.status_todo")}</SelectItem>
              <SelectItem value="InProgress">{t("task.status_in_progress")}</SelectItem>
              <SelectItem value="Done">{t("task.status_done")}</SelectItem>
              <SelectItem value="Cancelled">{t("task.status_cancelled")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter || "__all"} onValueChange={(v) => setPriorityFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder={t("task.col_priority")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("task.all_priorities")}</SelectItem>
              <SelectItem value="High">{t("task.priority_high")}</SelectItem>
              <SelectItem value="Medium">{t("task.priority_medium")}</SelectItem>
              <SelectItem value="Low">{t("task.priority_low")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter || "__all"} onValueChange={(v) => setCategoryFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("task.col_category")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("task.all_categories")}</SelectItem>
              {["CS", "Maintenance", "Follow-up", "Admin", "Other"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
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
                        <Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                      </th>
                    )}
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("common.name")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("csticket.col_subject")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("task.col_status")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("task.col_priority")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("task.col_category")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("task.col_related")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("task.col_due_date")}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Quick Action</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagination.paginatedItems.map((task) => {
                    const isOverdue = task.due_date && task.due_date < today && task.task_status !== "Done" && task.task_status !== "Cancelled";
                    return (
                      <tr key={task.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(task.id) ? "bg-primary/5" : isOverdue ? "bg-red-50/50" : ""}`}>
                        {isSuperAdmin && (
                          <td className="px-3 py-2.5">
                            <Checkbox checked={selectedIds.has(task.id)} onCheckedChange={() => toggleSelect(task.id)} aria-label="Select task" onClick={(e) => e.stopPropagation()} />
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <Link href={`/sales/tasks/${task.id}`} className="font-medium hover:underline">{task.name}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[160px] truncate">{task.subject ?? "—"}</td>
                        <td className="px-4 py-2.5"><TaskStatusBadge status={task.task_status} /></td>
                        <td className="px-4 py-2.5"><PriorityBadge priority={task.priority} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{task.task_category ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{(task as any).primary_contact_name ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {task.due_date ? (
                            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                              {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                              {task.due_date}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {task.task_status === "Todo" && (
                            <button
                              className="text-[10px] px-2 py-1 rounded border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-1 font-medium"
                              onClick={() => handleStatusChange(task.id, "InProgress")}
                            >
                              <Play className="h-2.5 w-2.5" /> {t("task.btn_start")}
                            </button>
                          )}
                          {task.task_status === "InProgress" && (
                            <button
                              className="text-[10px] px-2 py-1 rounded border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 flex items-center gap-1 font-medium"
                              onClick={() => handleStatusChange(task.id, "Done")}
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" /> {t("task.btn_complete")}
                            </button>
                          )}
                          {task.task_status === "Done" && (
                            <span className="text-[10px] text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> {t("task.status_done")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/sales/tasks/${task.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(task.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!tasks || tasks.length === 0) && (
                    <tr><td colSpan={isSuperAdmin ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">{t("task.no_tasks")}</td></tr>
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
            <AlertDialogTitle>{t("task.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.cannot_undo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Tasks" : "Archive Tasks"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} task(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} task(s). They will be hidden from view.`}
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
