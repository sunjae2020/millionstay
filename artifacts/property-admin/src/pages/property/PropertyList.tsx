import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListProperties,
  useDeleteProperty,
  getListPropertiesQueryKey,
  type ListPropertiesParams,
  type PropertyListItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/date";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PropertyList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params: ListPropertiesParams & { deleted?: string } = {
    search: search || undefined,
    approval_status: approvalStatus || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: properties, isLoading } = useListProperties(params, {
    query: { queryKey: getListPropertiesQueryKey(params) },
  });

  const deleteMutation = useDeleteProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const columns: ColumnDef<PropertyListItem>[] = useMemo(
    () => [
      {
        key: "name",
        header: "property.col_name",
        hideable: false,
        defaultWidth: 200,
        cell: (prop) => (
          <Link href={`/property/properties/${prop.id}`} className="hover:underline text-primary font-medium">
            {prop.name}
          </Link>
        ),
      },
      {
        key: "address",
        header: "property.col_address",
        cell: (prop) => <span className="text-muted-foreground text-xs">{prop.address ?? "—"}</span>,
      },
      {
        key: "owner_account_name",
        header: "property.col_owner",
        cell: (prop) => (
          <span className="text-muted-foreground text-xs">
            {prop.owner_account_name ?? (prop.owner_account_id ? `#${prop.owner_account_id}` : "—")}
          </span>
        ),
      },
      {
        key: "suburb_name",
        header: "property.col_suburb",
        cell: (prop) => <span className="text-muted-foreground text-xs">{prop.suburb_name ?? "—"}</span>,
      },
      {
        key: "approval_status",
        header: "property.col_status",
        cell: (prop) => <StatusBadge status={prop.approval_status} />,
      },
      {
        key: "created_at",
        header: "property.col_created",
        sortAccessor: (prop) => prop.created_at,
        cell: (prop) => <span className="text-muted-foreground text-xs">{formatDate(prop.created_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (prop) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/property/properties/${prop.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              onClick={() => setDeleteId(prop.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.property")}
        subtitle={`${properties?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/properties/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("property.new")}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("property.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={approvalStatus || "_all"} onValueChange={(v) => setApprovalStatus(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder={t("common.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("property.all_statuses")}</SelectItem>
              <SelectItem value="Pending">{t("common.pending") || "Pending"}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Suspended">{t("common.suspended") || "Suspended"}</SelectItem>
              <SelectItem value="Rejected">{t("common.rejected") || "Rejected"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          tableKey="properties"
          columns={columns}
          data={properties ?? []}
          isLoading={isLoading}
          rowKey={(prop) => prop.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("property.no_properties")}
          selection={{
            enable: true,
            resource: "properties",
            onChanged: () => qc.invalidateQueries({ queryKey: getListPropertiesQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("property.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("property.delete_desc")}</AlertDialogDescription>
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
