import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  useListWorkOrders,
  getListWorkOrdersQueryKey,
  type ListWorkOrdersParams,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { ALL, SearchBox, DateRangeFilter, FacetSelect, ResetFiltersButton, useListFacets, useYearLabel } from "@/components/list-filters";
import { useQueryClient } from "@tanstack/react-query";

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
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const params: ListWorkOrdersParams & Record<string, string | undefined> = {
    q: q || undefined,
    status: status === ALL ? undefined : status,
    priority: priority === ALL ? undefined : priority,
    category: category === ALL ? undefined : category,
    year: year === ALL ? undefined : year,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };
  const { data: facets } = useListFacets("work-orders", showDeleted);
  const yearLabel = useYearLabel();
  const hasFilters = !!q || status !== ALL || priority !== ALL || category !== ALL || year !== ALL || !!dateFrom || !!dateTo;
  const resetFilters = () => {
    setQ(""); setStatus(ALL); setPriority(ALL); setCategory(ALL); setYear(ALL); setDateFrom(""); setDateTo("");
  };

  const { data: workOrdersRaw = [], isLoading } = useListWorkOrders(params, {
    query: { queryKey: getListWorkOrdersQueryKey(params) },
  });

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "order_ref",
        header: "workorder.col_ref",
        cell: (wo) => <Link href={`/maintenance/work-orders/${wo.id}`} className="font-medium text-primary hover:underline">{wo.order_ref}</Link>,
      },
      {
        key: "title",
        header: "workorder.col_title",
        hideable: false,
        cell: (wo) => <Link href={`/maintenance/work-orders/${wo.id}`} className="font-medium hover:underline">{wo.title}</Link>,
      },
      {
        key: "property_name",
        header: "workorder.col_property",
        cell: (wo) => <span className="text-muted-foreground">{wo.property_name ?? "—"}</span>,
      },
      {
        key: "space_name",
        header: "workorder.col_space",
        cell: (wo) => <span className="text-muted-foreground">{wo.space_name ?? "—"}</span>,
      },
      {
        key: "category",
        header: "workorder.col_category",
        cell: (wo) => <span className="text-muted-foreground">{wo.category ?? "—"}</span>,
      },
      {
        key: "assigned_contact_name",
        header: "workorder.col_assigned",
        cell: (wo) => <span className="text-muted-foreground">{wo.assigned_contact_name ?? "—"}</span>,
      },
      {
        key: "priority",
        header: "workorder.col_priority",
        cell: (wo) => (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[wo.priority] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`workorder.priority_${wo.priority.toLowerCase()}` as any)}
          </span>
        ),
      },
      {
        key: "status",
        header: "workorder.col_status",
        cell: (wo) => (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[wo.status] ?? "bg-gray-100 text-gray-600"}`}>
            {wo.status === "InProgress" ? t("workorder.status_in_progress") : wo.status === "PendingReview" ? t("workorder.status_pending_review") : t(`workorder.status_${wo.status.toLowerCase()}` as any)}
          </span>
        ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 60,
        cell: (wo) => (
          <Link href={`/maintenance/work-orders/${wo.id}`} className="inline-flex justify-end">
            <button className="p-1.5 rounded hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </Link>
        ),
      },
    ],
    [t],
  );

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

        <DataTable
          tableKey="work-orders"
          columns={columns}
          data={workOrdersRaw}
          isLoading={isLoading}
          rowKey={(wo) => wo.id}
          emptyText={t("workorder.no_workorders")}
          selection={{
            enable: true,
            resource: "work-orders",
            onChanged: () => qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder={t("workorder.search_placeholder")} />
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
              <FacetSelect
                value={category} onChange={setCategory} options={facets?.categories ?? []}
                allLabel={t("common.all_types")} className="w-40"
              />
              <FacetSelect
                value={year} onChange={setYear} options={facets?.years ?? []}
                allLabel={t("common.all_years")} labelOf={yearLabel} className="w-32"
              />
              <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
              <ResetFiltersButton show={hasFilters} onClick={resetFilters} />
            </div>
          }
        />
      </div>
    </Layout>
  );
}
