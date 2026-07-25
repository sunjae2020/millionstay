import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListBookings, useConfirmBooking, useCheckInBooking, getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, List, Calendar, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSortableData, SortableTh } from "@/components/ui/SortableTable";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BOOKING_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  PendingPayment: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PendingApproval: "bg-amber-100 text-amber-800 border-amber-200",
  Confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  Active: "bg-green-100 text-green-700 border-green-200",
  CheckedOut: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  NoShow: "bg-pink-100 text-pink-700 border-pink-200",
};

const CALENDAR_COLORS: Record<string, string> = {
  Draft: "#9ca3af",
  PendingPayment: "#eab308",
  PendingApproval: "#f59e0b",
  Confirmed: "#3b82f6",
  Active: "#22c55e",
  CheckedOut: "#6366f1",
  Cancelled: "#ef4444",
  NoShow: "#ec4899",
};

function BookingStatusBadge({ status }: { status: string }) {
  const cls = BOOKING_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{status}</span>;
}

function CalendarView({ bookings }: { bookings: any[] }) {
  const { t } = useTranslation();
  const today = new Date();
  const dates: Date[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const spaces = Array.from(new Set(bookings.map((b) => b.space_id).filter(Boolean)));
  const spaceNames: Record<number, string> = {};
  bookings.forEach((b) => { if (b.space_id) spaceNames[b.space_id] = b.space_name ?? `Space #${b.space_id}`; });

  function getBookingsForSpaceDate(spaceId: number, date: Date) {
    const dateStr = date.toISOString().slice(0, 10);
    return bookings.filter((b) => {
      if (b.space_id !== spaceId) return false;
      if (!b.check_in_date || !b.check_out_date) return false;
      return dateStr >= b.check_in_date && dateStr < b.check_out_date;
    });
  }

  if (spaces.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">
        {t('booking.no_spaces_calendar')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b sticky top-0 bg-white z-10">
          <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">{t('booking.col_space')}</div>
          {dates.map((d) => (
            <div key={d.toISOString()} className={`w-8 shrink-0 text-center py-2 border-r text-xs ${d.toDateString() === today.toDateString() ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"}`}>
              <div>{d.getDate()}</div>
              <div className="text-[10px]">{d.toLocaleDateString("en", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
        {spaces.map((spaceId) => (
          <div key={spaceId} className="flex border-b hover:bg-gray-50">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-medium border-r truncate">{spaceNames[spaceId]}</div>
            {dates.map((d) => {
              const bks = getBookingsForSpaceDate(spaceId!, d);
              const bk = bks[0];
              return (
                <div key={d.toISOString()} className="w-8 shrink-0 border-r relative h-10">
                  {bk && (
                    <Link href={`/booking/bookings/${bk.id}`}>
                      <div
                        className="absolute inset-0.5 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: CALENDAR_COLORS[bk.booking_status] ?? "#9ca3af" }}
                        title={`${bk.booking_ref} — ${bk.booking_status}`}
                      />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="p-3 flex flex-wrap gap-3 border-t">
        {Object.entries(CALENDAR_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = {
    search: search || undefined,
    booking_status: statusFilter || undefined,
    booking_source: sourceFilter || undefined,
  };
  const { data: bookings, isLoading } = useListBookings(params, {
    query: { queryKey: getListBookingsQueryKey(params) },
  });

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(bookings ?? [], {
    accessors: { guest: (b: any) => b.account_name ?? b.contact_name ?? "" },
  });

  const pageIds = (bookings ?? []).map((b) => b.id);
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
      const res = await apiFetch("/api/v1/bookings/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) });
      toast({ title: permanent ? `${data.affected} bookings permanently deleted` : `${data.affected} bookings archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const confirmMutation = useConfirmBooking({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }) },
  });
  const checkInMutation = useCheckInBooking({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }) },
  });

  return (
    <Layout>
      <PageHeader
        title={t("nav.booking")}
        subtitle={`${bookings?.length ?? 0} ${t("common.total")}`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="rounded-none px-3" onClick={() => setView("list")}>
                <List className="w-4 h-4 mr-1" /> {t("booking.view_list")}
              </Button>
              <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" className="rounded-none px-3 border-l" onClick={() => setView("calendar")}>
                <Calendar className="w-4 h-4 mr-1" /> {t("booking.view_calendar")}
              </Button>
            </div>
            <Link href="/booking/bookings/new">
              <Button><Plus className="w-4 h-4 mr-1" /> {t("booking.new")}</Button>
            </Link>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("booking.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "_all"} onValueChange={(v) => setStatusFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("booking.all_statuses")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("booking.all_statuses")}</SelectItem>
              {["Draft", "PendingPayment", "PendingApproval", "Confirmed", "Active", "CheckedOut", "Cancelled", "NoShow"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter || "_all"} onValueChange={(v) => setSourceFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={t("booking.all_sources")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("booking.all_sources")}</SelectItem>
              {["Direct", "Agent", "Website", "Referral"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {view === "calendar" ? (
          <CalendarView bookings={bookings ?? []} />
        ) : (
          <>
          {isSuperAdmin && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-medium text-primary">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
              <button onClick={clearSelection} className="text-primary hover:text-primary"><X className="h-3.5 w-3.5" /></button>
              <div className="ml-auto flex items-center gap-2">
                {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                  <Archive className="h-3.5 w-3.5" /> Archive Selected
                </Button>
                <Button size="sm" variant="destructive" className="h-7 gap-1.5" onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete Forever
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {isSuperAdmin && <th className="px-3 py-3 w-8"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></th>}
                  {[
                    { label: t("booking.col_ref"), key: "booking_ref" },
                    { label: t("booking.col_guest"), key: "guest" },
                    { label: t("booking.col_space"), key: "space_name" },
                    { label: t("booking.col_checkin"), key: "check_in_date" },
                    { label: t("booking.col_checkout"), key: "check_out_date" },
                    { label: t("booking.col_nights"), key: "stay_nights" },
                    { label: t("booking.col_rate"), key: "agreed_weekly_rate" },
                    { label: t("booking.col_status"), key: "booking_status" },
                    { label: t("booking.col_source"), key: "booking_source" },
                    { label: t("common.actions"), key: null },
                  ].map((h) => (
                    h.key
                      ? <SortableTh key={h.label} sortKey={h.key} activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h.label}</SortableTh>
                      : <th key={h.label} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={isSuperAdmin ? 11 : 10} className="text-center py-12 text-muted-foreground">{t("common.loading")}</td></tr>
                ) : !bookings?.length ? (
                  <tr><td colSpan={isSuperAdmin ? 11 : 10} className="text-center py-12 text-muted-foreground">{t("booking.no_bookings")}</td></tr>
                ) : sorted.map((b) => (
                  <tr key={b.id} className={`border-b hover:bg-gray-50 transition-colors ${selectedIds.has(b.id) ? "bg-primary/5" : ""}`}>
                    {isSuperAdmin && <td className="px-3 py-3"><Checkbox checked={selectedIds.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} onClick={(e) => e.stopPropagation()} /></td>}
                    <td className="px-4 py-3">
                      <Link href={`/booking/bookings/${b.id}`} className="font-mono text-xs text-primary hover:underline">{b.booking_ref}</Link>
                    </td>
                    <td className="px-4 py-3">{b.account_name ?? b.contact_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.space_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.check_in_date ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.check_out_date ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{b.stay_nights ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.agreed_weekly_rate ? `$${parseFloat(b.agreed_weekly_rate).toFixed(0)}/wk` : "—"}</td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.booking_status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{b.booking_source ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {b.booking_status === "PendingApproval" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={() => confirmMutation.mutate({ id: b.id })}>
                            {t("booking.btn_confirm")}
                          </Button>
                        )}
                        {b.booking_status === "Confirmed" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-primary border-primary/30" onClick={() => checkInMutation.mutate({ id: b.id })}>
                            {t("booking.btn_checkin")}
                          </Button>
                        )}
                        <Link href={`/booking/bookings/${b.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">{t("common.open")}</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </>
        )}
      </div>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Bookings" : "Archive Bookings"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} booking(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} booking(s). They will be hidden from view.`}
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
