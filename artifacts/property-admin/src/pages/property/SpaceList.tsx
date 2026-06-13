import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useListSpaces,
  useDeleteSpace,
  getListSpacesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Archive, X, AlertTriangle, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/date";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
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
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

export default function SpaceList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [search, setSearch] = useState("");
  const [spaceType, setSpaceType] = useState("");
  const [status, setStatus] = useState("");
  const [bookingMode, setBookingMode] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = {
    search: search || undefined,
    space_type: spaceType || undefined,
    status: status || undefined,
    booking_mode: bookingMode || undefined,
  };

  const { data: spaces, isLoading } = useListSpaces(params, {
    query: { queryKey: getListSpacesQueryKey(params) },
  });

  const pagination = usePagination(spaces ?? []);

  const deleteMutation = useDeleteSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const pageIds = pagination.paginatedItems.map((s) => s.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n; });
    }
  };
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const handleBulkDelete = async (permanent: boolean) => {
    setIsBulkLoading(true);
    setBulkAction(null);
    try {
      const res = await apiFetch("/api/v1/spaces/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
      toast({ title: permanent ? `${data.affected} spaces permanently deleted` : `${data.affected} spaces archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t("nav.space")}
        subtitle={`${spaces?.length ?? 0} ${t("common.total")}`}
        actions={
          <Link href="/property/spaces/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("space.new")}
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("space.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
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
          <Select value={status || "_all"} onValueChange={(v) => setStatus(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("space.all_statuses")}</SelectItem>
              <SelectItem value="Active">{t("common.active")}</SelectItem>
              <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
              <SelectItem value="Suspended">{t("common.suspended") || "Suspended"}</SelectItem>
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

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200">
            <span className="text-sm font-medium text-orange-800">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button onClick={clearSelection} className="text-orange-500 hover:text-orange-700"><X className="h-3.5 w-3.5" /></button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                <Archive className="h-3.5 w-3.5" /> Archive Selected
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5" onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Forever
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {isSuperAdmin && (
                  <th className="px-3 py-3 w-8">
                    <Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_name")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_property")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_type")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_status")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_policy")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_parent")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("space.col_created")}</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
              ) : spaces?.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("space.no_spaces")}</td></tr>
              ) : (
                pagination.paginatedItems.map((space) => (
                  <tr key={space.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(space.id) ? "bg-orange-50/50" : ""}`}>
                    {isSuperAdmin && (
                      <td className="px-3 py-3">
                        <Checkbox checked={selectedIds.has(space.id)} onCheckedChange={() => toggleSelect(space.id)} aria-label="Select space" onClick={(e) => e.stopPropagation()} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/property/spaces/${space.id}`} className="hover:underline text-[#E8621A]">{space.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.property_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.space_type ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={space.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.policy_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{space.parent_space_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(space.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/property/spaces/${space.id}`}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" onClick={() => setDeleteId(space.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination {...pagination} />
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

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Spaces" : "Archive Spaces"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} space(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} space(s). They will be hidden from view.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant={bulkAction === "permanent" ? "destructive" : "outline"}
              className={bulkAction !== "permanent" ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
              onClick={() => handleBulkDelete(bulkAction === "permanent")}>
              {bulkAction === "permanent" ? "Delete Forever" : "Archive All"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
