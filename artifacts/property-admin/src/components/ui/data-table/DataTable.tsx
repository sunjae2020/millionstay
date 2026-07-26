import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  RotateCcw,
  Trash2,
  Eye,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSortableData } from "@/components/ui/SortableTable";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ACTIONS_KEY, type ColumnDef } from "./types";
import { useTablePrefs } from "./useTablePrefs";
import { ResizableSortableTh } from "./ResizableSortableTh";
import { ColumnsMenu } from "./ColumnsMenu";

export interface DataTableSelection {
  enable: boolean;
  /** Resource base for /api/v1/<resource>/bulk-delete|bulk-restore. */
  resource: string;
  /** Called after a successful bulk mutation (page invalidates its query). */
  onChanged?: () => void;
}

export interface DataTableProps<T> {
  tableKey: string;
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  rowKey: (row: T) => string | number;
  emptyText?: React.ReactNode;
  defaultSort?: { key: string; dir?: "asc" | "desc" };
  defaultPageSize?: number;
  selection?: DataTableSelection;
  /** Deleted-rows view (SuperAdmin). The page owns the actual fetch. */
  showDeleted?: boolean;
  onToggleShowDeleted?: (next: boolean) => void;
  /** Extra content rendered in the toolbar (left of Columns), e.g. page filters. */
  toolbarExtra?: React.ReactNode;
  className?: string;
}

type BulkAction = "archive" | "permanent" | "restore" | null;

export function DataTable<T>({
  tableKey,
  columns,
  data,
  isLoading,
  rowKey,
  emptyText,
  defaultSort,
  defaultPageSize,
  selection,
  showDeleted = false,
  onToggleShowDeleted,
  toolbarExtra,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const { toast } = useToast();

  const prefs = useTablePrefs(tableKey, columns);

  const accessors = useMemo(() => {
    const map: Record<string, (row: T) => unknown> = {};
    for (const c of columns) if (c.sortAccessor) map[c.key] = c.sortAccessor;
    return map;
  }, [columns]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(data, {
    defaultKey: defaultSort?.key ?? null,
    defaultDir: defaultSort?.dir ?? "asc",
    accessors,
  });
  const pagination = usePagination(sorted, defaultPageSize);

  const selectionEnabled = !!selection?.enable && isSuperAdmin;
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const pageIds = pagination.paginatedItems.map(rowKey);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  };
  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  async function runBulk(ids: (string | number)[], action: Exclude<BulkAction, null>) {
    if (!selection || ids.length === 0) return;
    setIsBulkLoading(true);
    setBulkAction(null);
    const base = `/api/v1/${selection.resource}`;
    try {
      const path = action === "restore" ? `${base}/bulk-restore` : `${base}/bulk-delete`;
      const body =
        action === "restore" ? { ids } : { ids, permanent: action === "permanent" };
      const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Request failed");
      const n = payload?.affected ?? ids.length;
      const msgKey =
        action === "restore"
          ? "common.bulk_restored"
          : action === "permanent"
            ? "common.bulk_purged"
            : "common.bulk_archived";
      toast({ title: t(msgKey, { count: n }) });
      clearSelection();
      selection.onChanged?.();
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsBulkLoading(false);
    }
  }

  const visibleCols = prefs.orderedVisibleColumns;
  const colSpan = visibleCols.length + (selectionEnabled ? 1 : 0);

  const dialogCopy: Record<Exclude<BulkAction, null>, { title: string; desc: string; confirm: string; danger: boolean }> = {
    archive: {
      title: t("common.archive_selected_title"),
      desc: t("common.archive_selected_desc", { count: selectedIds.size }),
      confirm: t("common.archive"),
      danger: false,
    },
    permanent: {
      title: t("common.purge_selected_title"),
      desc: t("common.purge_selected_desc", { count: selectedIds.size }),
      confirm: t("common.purge"),
      danger: true,
    },
    restore: {
      title: t("common.restore_selected_title"),
      desc: t("common.restore_selected_desc", { count: selectedIds.size }),
      confirm: t("common.restore"),
      danger: false,
    },
  };

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {toolbarExtra}
        <div className="ml-auto flex items-center gap-2">
          {isSuperAdmin && onToggleShowDeleted && (
            <Button
              variant={showDeleted ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                clearSelection();
                onToggleShowDeleted(!showDeleted);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("common.show_deleted")}
            </Button>
          )}
          <ColumnsMenu
            columns={prefs.allColumnsInOrder}
            isHidden={prefs.isHidden}
            onToggle={prefs.setHidden}
            onReorder={prefs.setOrder}
          />
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={prefs.resetWidths}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t("common.reset_widths")}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionEnabled && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium text-primary">
            {t("common.n_selected", { count: selectedIds.size })}
          </span>
          <button onClick={clearSelection} className="text-primary hover:text-primary">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {showDeleted ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                  onClick={() => setBulkAction("restore")}
                  disabled={isBulkLoading}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> {t("common.restore")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1.5"
                  onClick={() => setBulkAction("permanent")}
                  disabled={isBulkLoading}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("common.purge")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                  onClick={() => setBulkAction("archive")}
                  disabled={isBulkLoading}
                >
                  <Archive className="h-3.5 w-3.5" /> {t("common.archive")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1.5"
                  onClick={() => setBulkAction("permanent")}
                  disabled={isBulkLoading}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("common.delete_forever")}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <colgroup>
              {selectionEnabled && <col style={{ width: 40 }} />}
              {visibleCols.map((c) => (
                <col key={c.key} style={{ width: prefs.widths[c.key] ?? c.defaultWidth }} />
              ))}
            </colgroup>
            <thead className="bg-muted/50 border-b">
              <tr>
                {selectionEnabled && (
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={allPageSelected}
                      data-state={
                        somePageSelected && !allPageSelected
                          ? "indeterminate"
                          : allPageSelected
                            ? "checked"
                            : "unchecked"
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                )}
                {visibleCols.map((col) => (
                  <ResizableSortableTh
                    key={col.key}
                    colKey={col.key}
                    label={typeof col.header === "string" ? t(col.header) : col.header}
                    align={col.align}
                    sortable={col.sortable !== false && col.key !== ACTIONS_KEY}
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    width={prefs.widths[col.key]}
                    minWidth={col.minWidth ?? 60}
                    onResize={prefs.setWidth}
                    className={col.headerClassName}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : (data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {emptyText ?? t("common.no_results")}
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((row) => {
                  const id = rowKey(row);
                  return (
                    <tr
                      key={id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        selectedIds.has(id) && "bg-primary/5",
                      )}
                    >
                      {selectionEnabled && (
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={selectedIds.has(id)}
                            onCheckedChange={() => toggleSelect(id)}
                            aria-label="Select row"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      )}
                      {visibleCols.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.cellClassName,
                          )}
                        >
                          {col.key === ACTIONS_KEY && showDeleted && selectionEnabled ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                className="p-1.5 rounded hover:bg-emerald-50 transition-colors"
                                title={t("common.restore")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runBulk([id], "restore");
                                }}
                              >
                                <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
                              </button>
                              {col.cell(row)}
                            </div>
                          ) : (
                            col.cell(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...pagination} />
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          {bulkAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {dialogCopy[bulkAction].danger && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {dialogCopy[bulkAction].title}
                </AlertDialogTitle>
                <AlertDialogDescription>{dialogCopy[bulkAction].desc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <Button
                  variant={dialogCopy[bulkAction].danger ? "destructive" : "outline"}
                  onClick={() => runBulk(Array.from(selectedIds), bulkAction)}
                >
                  {dialogCopy[bulkAction].confirm}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
