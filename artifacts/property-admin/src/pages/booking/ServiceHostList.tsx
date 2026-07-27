import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListServiceHosts, useDeleteServiceHost, getListServiceHostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ServiceHostList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params = { search: search || undefined };
  const { data: hosts, isLoading } = useListServiceHosts(params, {
    query: { queryKey: getListServiceHostsQueryKey(params) },
  });

  const deleteMutation = useDeleteServiceHost({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListServiceHostsQueryKey({}) });
        setDeleteId(null);
      },
    },
  });

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "name",
        header: "service_host.col_name",
        hideable: false,
        editable: { type: "text", getValue: (host) => host.name },
        cell: (host) => <Link href={`/booking/service-hosts/${host.id}`} className="font-medium text-primary hover:underline">{host.name}</Link>,
      },
      {
        key: "account_name",
        header: "service_host.col_account",
        cell: (host) => <span className="text-muted-foreground">{host.account_name ?? "—"}</span>,
      },
      {
        key: "type",
        header: "service_host.col_type",
        sortAccessor: (host) => (host.in_call ? "in" : "") + (host.out_call ? "out" : ""),
        cell: (host) => (
          <span className="flex gap-1 text-muted-foreground">
            {host.in_call && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{t("service_host.in_call")}</span>}
            {host.out_call && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{t("service_host.out_call")}</span>}
            {!host.in_call && !host.out_call && "—"}
          </span>
        ),
      },
      {
        key: "from_date",
        header: "service_host.col_period",
        editable: { type: "date", getValue: (host) => host.from_date ?? "" },
        cell: (host) => (
          <span className="text-muted-foreground">
            {host.from_date && host.to_date ? `${host.from_date} → ${host.to_date}` : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "service_host.col_status",
        editable: {
          type: "select",
          getValue: (host) => host.status,
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
          ],
        },
        cell: (host) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${host.status === "Active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {t(`common.${host.status.toLowerCase()}`)}
          </span>
        ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (host) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/booking/service-hosts/${host.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="w-3.5 h-3.5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(host.id)}>
              <Trash2 className="w-3.5 h-3.5" />
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
        title={t("nav.service_host")}
        subtitle={`${hosts?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/booking/service-hosts/new">
            <Button><Plus className="w-4 h-4 mr-1" /> {t("common.new")} {t("nav.service_host")}</Button>
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        <DataTable
          tableKey="service-hosts"
          columns={columns}
          data={hosts ?? []}
          isLoading={isLoading}
          rowKey={(host) => host.id}
          emptyText={t("service_host.no_hosts")}
          editing={{ resource: "service-hosts", onEdited: () => qc.invalidateQueries({ queryKey: getListServiceHostsQueryKey({}) }) }}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("service_host.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          }
        />
      </div>
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("service_host.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.cannot_undo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
