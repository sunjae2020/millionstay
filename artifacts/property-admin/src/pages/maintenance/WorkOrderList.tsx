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
            <p className="text-sm text-muted-foreground">{workOrders.length} total</p>
          </div>
          <Button onClick={() => navigate("/maintenance/work-orders/new")}>
            <Plus className="h-4 w-4 mr-1" />
            New Work Order
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Input
              placeholder="Search title..."
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
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="PendingReview">Pending Review</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All priorities</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Space</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
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
                      {wo.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[wo.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {wo.status === "InProgress" ? "In Progress" : wo.status === "PendingReview" ? "Pending Review" : wo.status}
                    </span>
                  </td>
                </tr>
              ))}
              {workOrdersRaw.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No work orders found</td>
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
