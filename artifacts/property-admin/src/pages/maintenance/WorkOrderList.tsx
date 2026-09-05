import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, FileSpreadsheet } from "lucide-react";
import { RepairBillingDialog } from "@/components/RepairBillingDialog";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { ALL, SearchBox, DateRangeFilter, FacetSelect, ResetFiltersButton, useListFacets, useYearLabel } from "@/components/list-filters";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkOrderCategoryLabel } from "@/lib/workOrderCategories";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { useBrand } from "@/contexts/ThemeContext";

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  PendingReview: "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

/**
 * 청구비용(실지급액) — what the billing statement actually charges for a job:
 * the stored net amount, else the vendor's cost minus withholding. Mirrors
 * billedAmountOf() in api-server/src/lib/documents/workOrderDocument.ts.
 */
function billedAmountOf(wo: any): number | null {
  if (wo.net_cost != null) return Number(wo.net_cost);
  if (wo.cost == null) return null;
  return Number(wo.cost) - Number(wo.withholding_amount ?? 0);
}

const priorityColors: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-orange-50 text-primary",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

/** 서버가 정렬할 수 있는 컬럼(api-server routes/work-orders.ts 의 WORK_ORDER_SORT 와 1:1).
 *  담당자·서비스호스트·청구금액은 서버 파생값이라 정렬 대상이 아니다. */
const SORTABLE_KEYS = [
  "order_ref", "title", "property_name", "space_name", "reported_at", "scheduled_at",
  "category", "priority", "status", "created_at", "updated_at",
];

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
  const [billingOpen, setBillingOpen] = useState(false);
  const qc = useQueryClient();
  const { currency: brandCurrency, currencyPosition } = useBrand();

  // ?space_id=N — arriving from a space's 하자보수 tab, scoped to that unit.
  const spaceIdFilter = new URLSearchParams(window.location.search).get("space_id");

  const filters = {
    q: q || undefined,
    ...(spaceIdFilter ? { space_id: spaceIdFilter } : {}),
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
  const categoryLabel = useWorkOrderCategoryLabel();
  const hasFilters = !!q || status !== ALL || priority !== ALL || category !== ALL || year !== ALL || !!dateFrom || !!dateTo;
  const resetFilters = () => {
    setQ(""); setStatus(ALL); setPriority(ALL); setCategory(ALL); setYear(ALL); setDateFrom(""); setDateTo("");
  };

  const { rows: workOrdersRaw, isLoading, server, invalidate } = useServerList<any>(
    "/api/v1/work-orders",
    { filters, sortableKeys: SORTABLE_KEYS, defaultSort: { key: "created_at", dir: "desc" } },
  );

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
        // 접수일 — reported_at is a date-only text column.
        key: "reported_at",
        header: "workorder.col_reported_at",
        cell: (wo) => <span className="text-muted-foreground">{wo.reported_at ? formatDate(wo.reported_at) : "—"}</span>,
      },
      {
        // 작업일 — the legacy date-only scheduled_at, falling back to the
        // appointment start (scheduled_start_at) and finally the completion.
        key: "scheduled_at",
        editable: { type: "date", getValue: (wo) => wo.scheduled_at ?? "" },
        header: "workorder.col_scheduled_at",
        sortAccessor: (wo) => wo.scheduled_at ?? wo.scheduled_start_at ?? wo.completed_at ?? null,
        cell: (wo) => {
          const d = wo.scheduled_at ?? wo.scheduled_start_at ?? wo.completed_at;
          return <span className="text-muted-foreground">{d ? formatDate(d) : "—"}</span>;
        },
      },
      {
        key: "category",
        header: "workorder.col_category",
        cell: (wo) => <span className="text-muted-foreground">{categoryLabel(wo.category)}</span>,
      },
      {
        key: "assigned_contact_name",
        header: "workorder.col_assigned",
        cell: (wo) => <span className="text-muted-foreground">{wo.assigned_contact_name ?? "—"}</span>,
      },
      {
        // 파트너 — the dispatched service host, distinct from the assigned
        // contact (an individual).
        key: "service_host_name",
        header: "workorder.col_partner",
        cell: (wo) => <span className="text-muted-foreground">{wo.service_host_name ?? "—"}</span>,
      },
      {
        key: "billed_amount",
        header: "workorder.col_billed_amount",
        align: "right",
        sortAccessor: (wo) => billedAmountOf(wo),
        cell: (wo) => {
          const amount = billedAmountOf(wo);
          return <span>{amount != null ? formatMoney(amount, brandCurrency, currencyPosition) : "—"}</span>;
        },
      },
      {
        key: "priority",
        header: "workorder.col_priority",
        // 우선순위·상태는 목록에서 가장 자주 바뀐다(현장 보고를 받아 바로 올린다).
        editable: {
          type: "select",
          getValue: (wo) => wo.priority,
          options: ["Low", "Normal", "High", "Urgent"].map((v) => ({
            value: v, label: t(`workorder.priority_${v.toLowerCase()}` as any),
          })),
        },
        cell: (wo) => (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[wo.priority] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`workorder.priority_${wo.priority.toLowerCase()}` as any)}
          </span>
        ),
      },
      {
        key: "status",
        header: "workorder.col_status",
        editable: {
          type: "select",
          getValue: (wo) => wo.status,
          options: [
            { value: "Open", label: t("workorder.status_open") },
            { value: "InProgress", label: t("workorder.status_in_progress") },
            { value: "PendingReview", label: t("workorder.status_pending_review") },
            { value: "Completed", label: t("workorder.status_completed") },
            { value: "Cancelled", label: t("workorder.status_cancelled") },
          ],
        },
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
    [t, categoryLabel, brandCurrency, currencyPosition],
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.work_order")}</h1>
            <p className="text-sm text-muted-foreground">{workOrdersRaw.length} {t("common.total")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBillingOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              {t("workorder.billing_statement", "Billing statement")}
            </Button>
            <Button onClick={() => navigate("/maintenance/work-orders/new")}>
              <Plus className="h-4 w-4 mr-1" />
              {t("workorder.new")}
            </Button>
          </div>
        </div>

        <DataTable
          tableKey="work-orders"
          columns={columns}
          data={workOrdersRaw}
          server={server}
          isLoading={isLoading}
          rowKey={(wo) => wo.id}
          editing={{ resource: "work-orders", onEdited: invalidate }}
          detailHref={(wo) => `/maintenance/work-orders/${wo.id}`}
          emptyText={t("workorder.no_workorders")}
          selection={{
            enable: true,
            resource: "work-orders",
            onChanged: () => invalidate(),
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
                allLabel={t("workorder.all_categories")} labelOf={categoryLabel} className="w-40"
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
      <RepairBillingDialog open={billingOpen} onOpenChange={setBillingOpen} />
    </Layout>
  );
}
