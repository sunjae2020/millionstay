import { useMemo, useState } from "react";
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
import { Plus, Search, Pencil, Archive, Calendar, Package, Zap } from "lucide-react";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { apiFetch } from "@/lib/apiFetch";

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

/** 서버가 정렬할 수 있는 컬럼(api-server routes/service-catalog.ts 의 SERVICE_SORT 와 1:1). */
const SORTABLE_KEYS = [
  "name", "service_type", "base_price", "currency", "billing_trigger",
  "is_optional", "is_refundable", "status", "created_at", "updated_at",
];

async function archiveService(id: number) {
  const res = await apiFetch(`/api/v1/services/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to archive");
  return res.json();
}

export default function ServiceList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const filters = {
    q: q || undefined,
    service_type: typeFilter !== "_all" ? typeFilter : undefined,
    status: statusFilter !== "_all" ? statusFilter : undefined,
    deleted: showDeleted ? "only" : undefined,
  };
  const { rows, isLoading, server, invalidate } = useServerList<any>("/api/v1/services", {
    filters,
    sortableKeys: SORTABLE_KEYS,
    defaultSort: { key: "name", dir: "asc" },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => archiveService(id),
    onSuccess: () => {
      invalidate();
      setArchiveId(null);
    },
  });


  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "name",
        header: "service.col_name",
        hideable: false,
        editable: { type: "text", getValue: (s) => s.name },
        cell: (s) => (
          <div>
            <Link href={`/services/${s.id}`} className="font-medium text-primary hover:underline">
              {s.name}
            </Link>
            {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
          </div>
        ),
      },
      {
        key: "service_type",
        header: "service.col_type",
        editable: {
          type: "select",
          getValue: (s) => s.service_type,
          options: ["one_time", "scheduled", "physical"].map((v) => ({ value: v, label: t(`service.type_${v}`) })),
        },
        cell: (s) => {
          const typeConf = TYPE_CONFIG[s.service_type] ?? { label: s.service_type, color: "bg-gray-100 text-gray-600", icon: Zap };
          const Icon = typeConf.icon;
          return (
            <Badge className={`text-xs gap-1 ${typeConf.color}`}>
              <Icon className="h-3 w-3" />{t(`service.type_${s.service_type}`)}
            </Badge>
          );
        },
      },
      {
        key: "base_price",
        header: "service.col_price",
        align: "right",
        cellClassName: "tabular-nums font-medium",
        editable: { type: "number", getValue: (s) => s.base_price ?? null, min: 0, step: 0.01 },
        cell: (s) => (s.base_price != null ? formatMoney(s.base_price, s.currency ?? currency, currencyPosition) : "—"),
      },
      {
        key: "billing_trigger",
        header: "service.col_billing",
        cellClassName: "text-xs text-muted-foreground",
        editable: {
          type: "select",
          getValue: (s) => s.billing_trigger,
          options: ["at_booking", "at_checkout", "on_request"].map((v) => ({ value: v, label: t(`service.trigger_${v}`) })),
        },
        cell: (s) => {
          const TRIGGER_LABELS: Record<string, string> = {
            at_booking: t("service.trigger_at_booking"),
            at_checkout: t("service.trigger_at_checkout"),
            on_request: t("service.trigger_on_request"),
          };
          return TRIGGER_LABELS[s.billing_trigger] ?? s.billing_trigger;
        },
      },
      {
        key: "is_optional",
        header: "service.col_optional",
        editable: { type: "boolean", getValue: (s) => !!s.is_optional },
        cell: (s) => (
          <span className={`text-xs ${s.is_optional ? "text-gray-400" : "text-primary font-medium"}`}>
            {s.is_optional ? t("common.optional") : t("common.required")}
          </span>
        ),
      },
      {
        key: "is_refundable",
        header: "service.col_refundable",
        editable: { type: "boolean", getValue: (s) => !!s.is_refundable },
        cell: (s) => (
          <span className={`text-xs ${s.is_refundable ? "text-green-600 font-medium" : "text-gray-400"}`}>
            {s.is_refundable ? t("common.yes") : t("common.no")}
          </span>
        ),
      },
      {
        key: "status",
        header: "service.col_status",
        editable: {
          type: "select",
          getValue: (s) => s.status,
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
            { value: "Archived", label: t("service.status_archived") },
          ],
        },
        cell: (s) => <Badge className={`text-xs ${STATUS_COLORS[s.status] ?? ""}`}>{t(`common.${s.status.toLowerCase()}`)}</Badge>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (s) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/services/${s.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setArchiveId(s.id)}>
              <Archive className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ),
      },
    ],
    [t, currency, currencyPosition],
  );

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
        <DataTable
          server={server}
          tableKey="service-catalog"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          rowKey={(s) => s.id}
          emptyText={t("service.no_services")}
          selection={{
            enable: true,
            resource: "services",
            onChanged: () => invalidate(),
          }}
          editing={{ resource: "services", onEdited: () => invalidate() }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
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
          }
        />
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
    </Layout>
  );
}
