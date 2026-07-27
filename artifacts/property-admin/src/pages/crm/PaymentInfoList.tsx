import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListPaymentInfo,
  useDeletePaymentInfo,
  getListPaymentInfoQueryKey,
  type ListPaymentInfoParams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

export default function PaymentInfoList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const qc = useQueryClient();

  const params: ListPaymentInfoParams & { deleted?: string } = {
    search: search || undefined,
    payment_type: typeFilter || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };
  const { data: records, isLoading } = useListPaymentInfo(params, {
    query: { queryKey: getListPaymentInfoQueryKey(params) },
  });

  const archiveMutation = useDeletePaymentInfo({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setIsPermanentDeleting(true);
    try {
      await apiFetch(`/api/v1/payment-info/${deleteId}?permanent=true`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() });
      setDeleteId(null);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  type PaymentRow = NonNullable<typeof records>[number];
  const columns: ColumnDef<PaymentRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "payment_info.col_name",
        hideable: false,
        defaultWidth: 200,
        editable: { type: "text", getValue: (r) => r.name },
        cell: (r) => (
          <Link href={`/crm/payment-info/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
        ),
      },
      {
        key: "payment_type",
        header: "payment_info.col_type",
        editable: {
          type: "select",
          getValue: (r) => r.payment_type,
          options: [
            { value: "BankTransfer", label: t("payment_info.type_bank_transfer") },
            { value: "Stripe", label: "Stripe" },
            { value: "Cash", label: t("payment_info.type_cash") },
            { value: "Other", label: t("payment_info.type_other") },
          ],
        },
        cell: (r) => <span className="text-muted-foreground">{r.payment_type}</span>,
      },
      {
        key: "bank_name",
        header: "payment_info.col_bank_account",
        editable: { type: "text", getValue: (r) => r.bank_name ?? "" },
        cell: (r) => (
          <span className="text-muted-foreground">
            {r.bank_name && <span>{r.bank_name}</span>}
            {r.bsb_number && <span className="ml-1 text-xs">BSB {r.bsb_number}</span>}
            {r.account_number && <span className="ml-1 text-xs">· {r.account_number}</span>}
            {r.stripe_account_id && <span className="text-xs font-mono">{r.stripe_account_id}</span>}
            {!r.bank_name && !r.stripe_account_id && <span>—</span>}
          </span>
        ),
      },
      {
        key: "status",
        header: "payment_info.col_status",
        editable: {
          type: "select",
          getValue: (r) => r.status,
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
          ],
        },
        cell: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (r) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/crm/payment-info/${r.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={() => setDeleteId(r.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.payment_info")}
        subtitle={`${records?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/crm/payment-info/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("payment_info.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <DataTable
          tableKey="payment-info"
          columns={columns}
          data={records}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("payment_info.no_records")}
          selection={{
            enable: true,
            resource: "payment-info",
            onChanged: () => qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() }),
          }}
          editing={{ resource: "payment-info", onEdited: () => qc.invalidateQueries({ queryKey: getListPaymentInfoQueryKey() }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder={t("payment_info.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
                  onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter || "__all"} onValueChange={(v) => setTypeFilter(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder={t("payment_info.payment_type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("payment_info.all_types")}</SelectItem>
                  <SelectItem value="BankTransfer">{t("payment_info.type_bank_transfer")}</SelectItem>
                  <SelectItem value="Stripe">Stripe</SelectItem>
                  <SelectItem value="Cash">{t("payment_info.type_cash")}</SelectItem>
                  <SelectItem value="Other">{t("payment_info.type_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {isSuperAdmin ? t("payment_info.dialog_title_delete") : t("payment_info.dialog_title_archive")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperAdmin
                ? t("payment_info.dialog_desc_delete")
                : t("payment_info.dialog_desc_archive")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isSuperAdmin ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => deleteId && archiveMutation.mutate({ id: deleteId })}
              disabled={archiveMutation.isPending}>
              {t("common.archive")}
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={isPermanentDeleting}>
                {t("payment_info.delete_forever")}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
