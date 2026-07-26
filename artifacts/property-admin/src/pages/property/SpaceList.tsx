import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { isLedgerStatusSet, LEDGER_STATUS_VALUES } from "@/lib/spaceStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListSpaces,
  useDeleteSpace,
  getListSpacesQueryKey,
  type ListSpacesParams,
  type SpaceListItem,
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

export default function SpaceList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [spaceType, setSpaceType] = useState("");
  const [parentSpaceId, setParentSpaceId] = useState("");
  const [status, setStatus] = useState("");
  const [bookingMode, setBookingMode] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

  const params: ListSpacesParams & { deleted?: string } = {
    search: search || undefined,
    space_type: spaceType || undefined,
    status: status || undefined,
    booking_mode: bookingMode || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: spaces, isLoading } = useListSpaces(params, {
    query: { queryKey: getListSpacesQueryKey(params) },
  });

  // Parent-space filter options, derived from the loaded rows. Instances that
  // group units under a container space (e.g. a per-unit-type "타입" parent) get
  // a meaningful filter here; instances with no parents keep the type filter.
  const parentOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const s of spaces ?? []) {
      if (s.parent_space_id != null && s.parent_space_name) {
        byId.set(s.parent_space_id, s.parent_space_name);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [spaces]);
  const hasParents = parentOptions.length > 0;

  // Parent filtering is client-side: the list already loads every row.
  const filtered = useMemo(() => {
    const list = spaces ?? [];
    if (!parentSpaceId) return list;
    return list.filter((s) => String(s.parent_space_id ?? "") === parentSpaceId);
  }, [spaces, parentSpaceId]);

  const deleteMutation = useDeleteSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const columns: ColumnDef<SpaceListItem>[] = useMemo(
    () => [
      {
        key: "name",
        header: "space.col_name",
        hideable: false,
        defaultWidth: 200,
        cell: (s) => (
          <Link href={`/property/spaces/${s.id}`} className="hover:underline text-primary font-medium">
            {s.name}
          </Link>
        ),
      },
      {
        key: "owner_name",
        header: "space.col_owner",
        cell: (s) => <span className="text-muted-foreground text-xs">{s.owner_name ?? "—"}</span>,
      },
      {
        key: "parent_space_name",
        header: "space.col_parent",
        cell: (s) => <span className="text-muted-foreground text-xs">{s.parent_space_name ?? "—"}</span>,
      },
      {
        key: "exclusive_area_m2",
        header: "space.label_exclusive_area",
        align: "right",
        cell: (s) => (
          <span className="text-muted-foreground text-xs">
            {s.exclusive_area_m2 != null ? `${s.exclusive_area_m2}㎡` : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "space.col_status",
        cell: (s) => <StatusBadge status={s.status} />,
      },
      {
        key: "policy_name",
        header: "space.col_policy",
        cell: (s) => <span className="text-muted-foreground text-xs">{s.policy_name ?? "—"}</span>,
      },
      {
        key: "updated_at",
        header: "space.col_updated",
        sortAccessor: (s) => s.updated_at,
        cell: (s) => <span className="text-muted-foreground text-xs">{formatDate(s.updated_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (s) => (
          <div className="flex items-center gap-1 justify-end">
            <Link href={`/property/spaces/${s.id}`}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
            <button
              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
              onClick={() => setDeleteId(s.id)}
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
        title={t("nav.space")}
        subtitle={`${filtered.length} ${t("common.total")}`}
        actions={
          <Link href="/property/spaces/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("space.new")}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <DataTable
          tableKey="spaces"
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          rowKey={(s) => s.id}
          defaultSort={{ key: "name", dir: "asc" }}
          emptyText={t("space.no_spaces")}
          selection={{
            enable: true,
            resource: "spaces",
            onChanged: () => qc.invalidateQueries({ queryKey: getListSpacesQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("space.search_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {hasParents ? (
                <Select value={parentSpaceId || "_all"} onValueChange={(v) => setParentSpaceId(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder={t("space.col_parent")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("space.all_parents")}</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={spaceType || "_all"} onValueChange={(v) => setSpaceType(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder={t("space.label_type")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t("space.all_types")}</SelectItem>
                    <SelectItem value="Private Room">{t("space.type_private") || "Private Room"}</SelectItem>
                    <SelectItem value="Shared Room">{t("space.type_shared") || "Shared Room"}</SelectItem>
                    <SelectItem value="Whole Property">{t("space.type_whole") || "Whole Property"}</SelectItem>
                    <SelectItem value="Desk">{t("space.type_desk") || "Desk"}</SelectItem>
                    <SelectItem value="Other">{t("space.type_other") || "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={status || "_all"} onValueChange={(v) => setStatus(v === "_all" ? "" : v)}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("space.all_statuses")}</SelectItem>
                  {isLedgerStatusSet ? (
                    LEDGER_STATUS_VALUES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Active">{t("common.active")}</SelectItem>
                      <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
                      <SelectItem value="Suspended">{t("common.suspended") || "Suspended"}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Select value={bookingMode || "_all"} onValueChange={(v) => setBookingMode(v === "_all" ? "" : v)}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder={t("space.label_mode")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("space.all_modes")}</SelectItem>
                  <SelectItem value="Instant">{t("space.mode_instant") || "Instant"}</SelectItem>
                  <SelectItem value="Request">{t("space.mode_request") || "Request"}</SelectItem>
                  <SelectItem value="Manual">{t("space.mode_manual") || "Manual"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space.delete_desc")}</AlertDialogDescription>
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
