import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useListWorkOrders } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  PendingReview: "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

const priorityColors: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-orange-50 text-[#E8621A]",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

export default function WorkOrderList() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("_all");
  const [priority, setPriority] = useState("_all");

  const { data: workOrdersRaw = [] } = useListWorkOrders({
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    priority: priority === "_all" ? undefined : priority,
  });

  const pagination = usePagination(workOrdersRaw);

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

        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_ref")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_title")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_property")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_space")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_category")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_assigned")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_priority")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("workorder.col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((wo) => (
                <tr
                  key={wo.id}
                  className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => navigate(`/maintenance/work-orders/${wo.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-[#E8621A]">{wo.order_ref}</td>
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
              {workOrdersRaw.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">{t("workorder.no_workorders")}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}
