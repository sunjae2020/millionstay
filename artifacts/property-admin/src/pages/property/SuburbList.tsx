import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListSuburbs,
  useDeleteSuburb,
  getListSuburbsQueryKey,
  type ListSuburbsParams,
  type Suburb,
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

export default function SuburbList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [state, setState] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params: ListSuburbsParams & { deleted?: string } = {
    search: search || undefined,
    country_code: countryCode || undefined,
    state: state || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: suburbs, isLoading } = useListSuburbs(params, {
    query: { queryKey: getListSuburbsQueryKey(params) },
  });

  const deleteMutation = useDeleteSuburb({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const columns: ColumnDef<Suburb>[] = useMemo(
    () => [
      {
        key: "name",
        header: "suburb.col_name",
        hideable: false,
        defaultWidth: 200,
        editable: { type: "text", getValue: (suburb) => suburb.name },
        cell: (suburb) => (
          <Link href={`/property/suburbs/${suburb.id}`} className="hover:underline text-primary font-medium">
            {suburb.name}
          </Link>
        ),
      },
      {
        key: "area_name",
        header: "suburb.col_area",
        editable: { type: "text", getValue: (suburb) => suburb.area_name ?? "" },
        cell: (suburb) => <span className="text-muted-foreground">{suburb.area_name ?? "—"}</span>,
      },
      {
        key: "state",
        header: "suburb.col_state",
        editable: { type: "text", getValue: (suburb) => suburb.state ?? "" },
        cell: (suburb) => <span className="text-muted-foreground">{suburb.state ?? "—"}</span>,
      },
      {
        key: "country_code",
        header: "suburb.col_country",
        editable: {
          type: "select",
          getValue: (suburb) => suburb.country_code,
          options: [
            { value: "AU", label: "AU" },
            { value: "US", label: "US" },
            { value: "GB", label: "GB" },
            { value: "NZ", label: "NZ" },
            { value: "KR", label: "KR" },
          ],
        },
        cell: (suburb) => <span className="text-muted-foreground">{suburb.country_code}</span>,
      },
      {
        key: "status",
        header: "suburb.col_status",
        editable: {
          type: "select",
          getValue: (suburb) => suburb.status,
          options: [
            { value: "Active", label: t("common.active") },
            { value: "Inactive", label: t("common.inactive") },
          ],
        },
        cell: (suburb) => <StatusBadge status={suburb.status} />,
      },
      {
        key: "created_at",
        header: "suburb.col_created",
        sortAccessor: (suburb) => suburb.created_at,
        cell: (suburb) => <span className="text-muted-foreground text-xs">{formatDate(suburb.created_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (suburb) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/property/suburbs/${suburb.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(suburb.id)}>
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
        title={t("nav.suburb")}
        subtitle={`${suburbs?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/suburbs/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("suburb.new") || `${t("common.new")} ${t("nav.suburb")}`}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <DataTable
          tableKey="suburbs"
          columns={columns}
          data={suburbs ?? []}
          isLoading={isLoading}
          rowKey={(suburb) => suburb.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("suburb.no_records") || "No suburbs found"}
          selection={{
            enable: true,
            resource: "suburbs",
            onChanged: () => qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() }),
          }}
          editing={{ resource: "suburbs", onEdited: () => qc.invalidateQueries({ queryKey: getListSuburbsQueryKey() }) }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("suburb.search_placeholder") || t("common.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select value={countryCode || "_all"} onValueChange={(v) => setCountryCode(v === "_all" ? "" : v)}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue placeholder={t("suburb.label_country") || "Country"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("suburb.all_countries") || "All Countries"}</SelectItem>
                  <SelectItem value="AU">{t("suburb.country_au")}</SelectItem>
                  <SelectItem value="US">{t("suburb.country_us")}</SelectItem>
                  <SelectItem value="GB">{t("suburb.country_gb")}</SelectItem>
                  <SelectItem value="NZ">{t("suburb.country_nz")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={t("suburb.state_filter_placeholder") || "State filter..."}
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-32 h-8 text-sm"
              />
            </div>
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("suburb.delete_title") || t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("suburb.delete_desc") || t("common.cannot_undo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
