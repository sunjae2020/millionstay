import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCommissions, useDeleteCommission, getListCommissionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CommissionList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = { search: search || undefined, status: statusFilter || undefined };
  const { data: commissions, isLoading } = useListCommissions(params, {
    query: { queryKey: getListCommissionsQueryKey(params) },
  });

  const pagination = usePagination(commissions ?? []);

  const deleteMutation = useDeleteCommission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  return (
    <Layout>
      <PageHeader
        title={t("nav.commission")}
        subtitle={`${commissions?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/crm/commissions/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("commission.new")}</Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("commission.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("commission.all_statuses")}</SelectItem>
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
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("commission.col_name")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("commission.col_type")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("commission.col_rate")}</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("commission.col_status")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagination.paginatedItems.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/crm/commissions/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.commission_type}</td>
                    <td className="px-4 py-2.5">
                      {c.commission_type === "Percentage"
                        ? `${c.commission_rate ?? "—"}%`
                        : `$${c.commission_amount ?? "—"}`}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/commissions/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!commissions || commissions.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("commission.no_commissions")}</td></tr>
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
            <AlertDialogTitle>{t("commission.delete_title")}</AlertDialogTitle>
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
