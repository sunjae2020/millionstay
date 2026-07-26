import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useListSpaceOptions,
  useDeleteSpaceOption,
  getListSpaceOptionsQueryKey,
  type ListSpaceOptionsParams,
  type SpaceOption,
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

export default function SpaceOptionList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params: ListSpaceOptionsParams & { deleted?: string } = {
    search: search || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: options, isLoading } = useListSpaceOptions(params, {
    query: { queryKey: getListSpaceOptionsQueryKey(params) },
  });

  const deleteMutation = useDeleteSpaceOption({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const columns: ColumnDef<SpaceOption>[] = useMemo(
    () => [
      {
        key: "name",
        header: "space_option.col_name",
        hideable: false,
        defaultWidth: 200,
        cell: (opt) => (
          <Link href={`/property/space-options/${opt.id}`} className="hover:underline text-primary font-medium">
            {opt.name}
          </Link>
        ),
      },
      {
        key: "display_name",
        header: "space_option.col_display_name",
        cell: (opt) => <span className="text-muted-foreground">{opt.display_name ?? "—"}</span>,
      },
      {
        key: "category",
        header: "space_option.col_category",
        cell: (opt) => <span className="text-muted-foreground">{opt.category ?? "—"}</span>,
      },
      {
        key: "status",
        header: "space_option.col_status",
        cell: (opt) => <StatusBadge status={opt.status} />,
      },
      {
        key: "created_at",
        header: "space_option.col_created",
        sortAccessor: (opt) => opt.created_at,
        cell: (opt) => <span className="text-muted-foreground text-xs">{formatDate(opt.created_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (opt) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/property/space-options/${opt.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(opt.id)}>
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
        title={t("nav.space_options")}
        subtitle={`${options?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/space-options/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("space_option.new") || `${t("common.new")} ${t("nav.space_option")}`}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <DataTable
          tableKey="space-options"
          columns={columns}
          data={options ?? []}
          isLoading={isLoading}
          rowKey={(opt) => opt.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("space_option.no_records") || "No space options found"}
          selection={{
            enable: true,
            resource: "space-options",
            onChanged: () => qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("space_option.search_placeholder") || t("common.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space_option.delete_title") || t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space_option.delete_desc") || t("common.cannot_undo")}</AlertDialogDescription>
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
