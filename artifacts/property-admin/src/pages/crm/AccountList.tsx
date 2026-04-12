import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useListAccounts, useDeleteAccount, getListAccountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = { search: search || undefined, account_type: typeFilter || undefined, status: statusFilter || undefined };
  const { data: accounts, isLoading } = useListAccounts(params, {
    query: { queryKey: getListAccountsQueryKey(params) },
  });

  const pagination = usePagination(accounts ?? []);

  const deleteMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        setDeleteId(null);
      },
    },
  });

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
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
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

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_name")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_type")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_primary_contact")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_email")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("account.col_status")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagination.paginatedItems.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-xs ${ACCOUNT_TYPE_COLORS[a.account_type] ?? "bg-gray-100 text-gray-700"}`}>
                        {a.account_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{(a as any).primary_contact_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.account_email ?? "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/accounts/${a.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!accounts || accounts.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("account.no_accounts")}</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("account.delete_title")}</AlertDialogTitle>
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
