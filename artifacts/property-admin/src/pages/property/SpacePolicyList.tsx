import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useListSpacePolicies,
  useDeleteSpacePolicy,
  getListSpacePoliciesQueryKey,
  type ListSpacePoliciesParams,
  type SpacePolicy,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Check, X } from "lucide-react";
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

function BoolCell({ value }: { value: boolean }) {
  const { t } = useTranslation();
  return value ? (
    <span className="inline-flex items-center gap-0.5 text-green-600 text-xs font-medium"><Check className="h-3 w-3" /> {t("common.yes")}</span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs"><X className="h-3 w-3" /> {t("common.no")}</span>
  );
}

export default function SpacePolicyList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params: ListSpacePoliciesParams & { deleted?: string } = {
    search: search || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: policies, isLoading } = useListSpacePolicies(params, {
    query: { queryKey: getListSpacePoliciesQueryKey(params) },
  });

  const deleteMutation = useDeleteSpacePolicy({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacePoliciesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const columns: ColumnDef<SpacePolicy>[] = useMemo(
    () => [
      {
        key: "name",
        header: "space_policy.col_name",
        hideable: false,
        defaultWidth: 200,
        cell: (policy) => (
          <Link href={`/property/space-policies/${policy.id}`} className="hover:underline text-primary font-medium">
            {policy.name}
          </Link>
        ),
      },
      {
        key: "same_gender",
        header: "space_policy.col_same_gender",
        cell: (policy) => <BoolCell value={policy.same_gender} />,
      },
      {
        key: "lady_only",
        header: "space_policy.col_lady_only",
        cell: (policy) => <BoolCell value={policy.lady_only} />,
      },
      {
        key: "no_pet",
        header: "space_policy.col_no_pet",
        cell: (policy) => <BoolCell value={policy.no_pet} />,
      },
      {
        key: "no_smoking",
        header: "space_policy.col_no_smoking",
        cell: (policy) => <BoolCell value={policy.no_smoking} />,
      },
      {
        key: "minimum_age",
        header: "space_policy.col_min_age",
        cell: (policy) => <span className="text-muted-foreground">{policy.minimum_age ?? "—"}</span>,
      },
      {
        key: "status",
        header: "space_policy.col_status",
        cell: (policy) => <StatusBadge status={policy.status} />,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (policy) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/property/space-policies/${policy.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(policy.id)}>
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
        title={t("nav.space_policy")}
        subtitle={`${policies?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/space-policies/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("space_policy.new") || `${t("common.new")} ${t("nav.space_policy")}`}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("space_policy.search_placeholder") || t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <DataTable
          tableKey="space-policies"
          columns={columns}
          data={policies ?? []}
          isLoading={isLoading}
          rowKey={(policy) => policy.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("space_policy.no_records") || "No policies found"}
          selection={{
            enable: true,
            resource: "space-policies",
            onChanged: () => qc.invalidateQueries({ queryKey: getListSpacePoliciesQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space_policy.delete_title") || t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space_policy.delete_desc") || t("common.cannot_undo")}</AlertDialogDescription>
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
