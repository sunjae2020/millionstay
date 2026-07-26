import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListBeneficiaries,
  getListBeneficiariesQueryKey,
  useDeleteBeneficiary,
  type ListBeneficiariesParams,
  type BeneficiaryResponse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-600",
  Archived: "bg-red-100 text-red-600",
};

const TYPE_COLORS: Record<string, string> = {
  Percentage: "bg-blue-100 text-blue-700",
  Fixed: "bg-amber-100 text-amber-700",
};

export default function BeneficiaryList() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const params: ListBeneficiariesParams & { deleted?: string } = {
    q: q || undefined,
    status: statusFilter === "_all" ? undefined : statusFilter,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: beneficiaries, isLoading } = useListBeneficiaries(params, {
    query: { queryKey: getListBeneficiariesQueryKey(params) },
  });

  const deleteMutation = useDeleteBeneficiary({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const filtered = (beneficiaries ?? []).filter((b) => {
    if (typeFilter !== "_all" && b.commission_type !== typeFilter) return false;
    return true;
  });

  const columns: ColumnDef<BeneficiaryResponse>[] = useMemo(
    () => [
      {
        key: "name",
        header: "beneficiary.col_name",
        hideable: false,
        cell: (b) => (
          <Link href={`/products/beneficiaries/${b.id}`} className="text-primary hover:underline font-medium">
            {b.name}
          </Link>
        ),
      },
      {
        key: "account_name",
        header: "beneficiary.col_account",
        cell: (b) => (
          <span className="text-muted-foreground text-xs">
            {b.account_name ?? <span className="italic opacity-50">—</span>}
          </span>
        ),
      },
      {
        key: "contract_product_name",
        header: "beneficiary.col_product",
        cellClassName: "max-w-[200px] truncate",
        cell: (b) => (
          <span className="text-muted-foreground text-xs">
            {b.contract_product_name ?? <span className="italic opacity-50">All products</span>}
          </span>
        ),
      },
      {
        key: "commission_name",
        header: "beneficiary.col_commission",
        cell: (b) => (
          <span className="text-muted-foreground text-xs">
            {b.commission_name ?? <span className="italic opacity-50">Custom</span>}
          </span>
        ),
      },
      {
        key: "commission_type",
        header: "beneficiary.col_type",
        cell: (b) => (
          <Badge className={`text-xs ${TYPE_COLORS[b.commission_type] ?? "bg-gray-100 text-gray-600"}`}>
            {b.commission_type}
          </Badge>
        ),
      },
      {
        key: "rate",
        header: "beneficiary.col_rate",
        align: "right",
        sortAccessor: (b) =>
          b.commission_type === "Percentage"
            ? b.split_percentage != null
              ? Number(b.split_percentage)
              : null
            : b.fixed_amount != null
              ? Number(b.fixed_amount)
              : null,
        cell: (b) => (
          <span className="text-xs tabular-nums font-semibold text-primary">
            {b.commission_type === "Percentage"
              ? b.split_percentage != null ? `${b.split_percentage}%` : "—"
              : b.fixed_amount != null ? `$${Number(b.fixed_amount).toFixed(2)}` : "—"}
          </span>
        ),
      },
      {
        key: "priority",
        header: "beneficiary.col_priority",
        align: "center",
        cell: (b) => <span className="text-xs">{b.priority ?? 1}</span>,
      },
      {
        key: "status",
        header: "beneficiary.col_status",
        cell: (b) => (
          <Badge className={`text-xs ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
            {b.status}
          </Badge>
        ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (b) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/products/beneficiaries/${b.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              onClick={() => setDeleteId(b.id)}
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
        title={t("nav.beneficiary")}
        subtitle={`${filtered.length} of ${beneficiaries?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/products/beneficiaries/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("common.new")} {t("nav.beneficiary")}
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        <DataTable
          tableKey="beneficiaries"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(b) => b.id}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("beneficiary.search_placeholder")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t("beneficiary.all_types")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("beneficiary.all_types")}</SelectItem>
                  <SelectItem value="Percentage">{t("beneficiary.type_percentage")}</SelectItem>
                  <SelectItem value="Fixed">{t("beneficiary.type_fixed")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("beneficiary.all_statuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("beneficiary.all_statuses")}</SelectItem>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
                  <SelectItem value="Archived">{t("beneficiary.status_archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          emptyText={
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">{t("beneficiary.no_beneficiaries")}</p>
              <p className="text-xs">{t("beneficiary.no_beneficiaries_sub")}</p>
              <Link href="/products/beneficiaries/new">
                <Button size="sm" variant="outline">{t("beneficiary.add_first")}</Button>
              </Link>
            </div>
          }
          selection={{
            enable: true,
            resource: "beneficiaries",
            onChanged: () => qc.invalidateQueries({ queryKey: getListBeneficiariesQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("beneficiary.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("beneficiary.delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
