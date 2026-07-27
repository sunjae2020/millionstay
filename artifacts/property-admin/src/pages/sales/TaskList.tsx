import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListTasks,
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  getListTasksQueryKey,
  type ListTasksParams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, CheckCircle2, AlertCircle, Play } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params: ListTasksParams & { deleted?: string } = {
    search: search || undefined,
    task_status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    task_category: categoryFilter || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };
  const { data: tasks, isLoading } = useListTasks(params, {
    query: { queryKey: getListTasksQueryKey(params) },
  });

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

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "name",
        header: "common.name",
        hideable: false,
        editable: { type: "text", getValue: (task) => task.name },
        cell: (task) => <Link href={`/sales/tasks/${task.id}`} className="font-medium hover:underline">{task.name}</Link>,
      },
      {
        key: "subject",
        header: "csticket.col_subject",
        editable: { type: "text", getValue: (task) => task.subject ?? "" },
        cell: (task) => <span className="text-muted-foreground max-w-[160px] truncate inline-block align-bottom">{task.subject ?? "—"}</span>,
      },
      {
        key: "task_status",
        header: "task.col_status",
        editable: {
          type: "select",
          getValue: (task) => task.task_status,
          options: [
            { value: "Todo", label: t("task.status_todo") },
            { value: "InProgress", label: t("task.status_in_progress") },
            { value: "Done", label: t("task.status_done") },
            { value: "Cancelled", label: t("task.status_cancelled") },
          ],
        },
        cell: (task) => <TaskStatusBadge status={task.task_status} />,
      },
      {
        key: "priority",
        header: "task.col_priority",
        editable: {
          type: "select",
          getValue: (task) => task.priority,
          options: [
            { value: "High", label: t("task.priority_high") },
            { value: "Medium", label: t("task.priority_medium") },
            { value: "Low", label: t("task.priority_low") },
          ],
        },
        cell: (task) => <PriorityBadge priority={task.priority} />,
      },
      {
        key: "task_category",
        header: "task.col_category",
        editable: {
          type: "select",
          getValue: (task) => task.task_category ?? "",
          options: ["CS", "Maintenance", "Follow-up", "Admin", "Other"].map((c) => ({ value: c, label: c })),
        },
        cell: (task) => <span className="text-muted-foreground">{task.task_category ?? "—"}</span>,
      },
      {
        key: "primary_contact_name",
        header: "task.col_related",
        cell: (task) => <span className="text-muted-foreground">{task.primary_contact_name ?? "—"}</span>,
      },
      {
        key: "due_date",
        header: "task.col_due_date",
        editable: { type: "date", getValue: (task) => task.due_date ?? "" },
        cell: (task) => {
          const isOverdue = task.due_date && task.due_date < today && task.task_status !== "Done" && task.task_status !== "Cancelled";
          return task.due_date ? (
            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
              {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
              {task.due_date}
            </span>
          ) : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        key: "quick_action",
        header: "Quick Action",
        sortable: false,
        cell: (task) => (
          <>
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
          </>
        ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (task) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/sales/tasks/${task.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(task.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [t, today],
  );

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

        <DataTable
          tableKey="tasks"
          columns={columns}
          data={tasks ?? []}
          isLoading={isLoading}
          rowKey={(task) => task.id}
          emptyText={t("task.no_tasks")}
          selection={{
            enable: true,
            resource: "tasks",
            onChanged: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }),
          }}
          editing={{ resource: "tasks", onEdited: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
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
          }
        />
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
    </Layout>
  );
}
