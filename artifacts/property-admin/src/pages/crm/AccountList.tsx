import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useListAccounts,
  useDeleteAccount,
  getListAccountsQueryKey,
  type ListAccountsParams,
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

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Guest: "bg-blue-100 text-blue-700 border-blue-200",
  SpaceOwner: "bg-purple-100 text-purple-700 border-purple-200",
  Broker: "bg-teal-100 text-teal-700 border-teal-200",
  Manager: "bg-cyan-100 text-cyan-700 border-cyan-200",
  RealEstateAgent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ServiceHost: "bg-orange-100 text-orange-700 border-orange-200",
  Partner: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export default function AccountList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const qc = useQueryClient();

  const params: ListAccountsParams & { deleted?: string } = {
    search: search || undefined,
    account_type: typeFilter || undefined,
    status: statusFilter || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };
  const { data: accounts, isLoading } = useListAccounts(params, {
    query: { queryKey: getListAccountsQueryKey(params) },
  });

  const archiveMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setIsPermanentDeleting(true);
    try {
      await apiFetch(`/api/v1/accounts/${deleteId}?permanent=true`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      setDeleteId(null);
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  type AccountRow = NonNullable<typeof accounts>[number];
  const columns: ColumnDef<AccountRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "account.col_name",
        hideable: false,
        defaultWidth: 200,
        editable: { type: "text", getValue: (a) => a.name },
        cell: (a) => (
          <Link href={`/crm/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
        ),
      },
      {
        key: "account_type",
        header: "account.col_type",
        editable: {
          type: "select",
          getValue: (a) => a.account_type,
          options: Object.keys(ACCOUNT_TYPE_COLORS).map((k) => ({ value: k, label: k })),
        },
        cell: (a) => (
          <Badge variant="outline" className={`text-xs ${ACCOUNT_TYPE_COLORS[a.account_type] ?? "bg-gray-100 text-gray-700"}`}>
            {a.account_type}
          </Badge>
        ),
      },
      {
        key: "primary_contact_name",
        header: "account.col_primary_contact",
        cell: (a) => <span className="text-muted-foreground">{(a as any).primary_contact_name ?? "—"}</span>,
      },
      {
        key: "account_email",
        header: "account.col_email",
        editable: { type: "text", getValue: (a) => a.account_email ?? "" },
        cell: (a) => <span className="text-muted-foreground">{a.account_email ?? "—"}</span>,
      },
      {
        key: "status",
        header: "account.col_status",
        editable: {
          type: "select",
          getValue: (a) => a.status,
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
          ],
        },
        cell: (a) => <StatusBadge status={a.status} />,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (a) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/crm/accounts/${a.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={() => setDeleteId(a.id)}>
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
        title={t("nav.account")}
        subtitle={`${accounts?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/crm/accounts/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("account.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <DataTable
          tableKey="accounts"
          columns={columns}
          data={accounts}
          isLoading={isLoading}
          rowKey={(a) => a.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("account.no_accounts")}
          selection={{
            enable: true,
            resource: "accounts",
            onChanged: () => qc.invalidateQueries({ queryKey: getListAccountsQueryKey() }),
          }}
          editing={{ resource: "accounts", onEdited: () => qc.invalidateQueries({ queryKey: getListAccountsQueryKey() }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder={t("account.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
                  onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter || "__all"} onValueChange={(v) => setTypeFilter(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder={t("account.account_type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("account.all_types")}</SelectItem>
                  {Object.keys(ACCOUNT_TYPE_COLORS).map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("account.all_statuses")}</SelectItem>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
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
              {isSuperAdmin ? "Delete Account" : "Archive Account"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuperAdmin
                ? "Choose how to remove this account. Archiving hides it from view but keeps the data. Permanent deletion cannot be undone."
                : "This account will be archived and hidden from view. A Super Admin can restore it if needed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isSuperAdmin ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => deleteId && archiveMutation.mutate({ id: deleteId })}
              disabled={archiveMutation.isPending}>
              Archive
            </Button>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={isPermanentDeleting}>
                Delete Forever
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
