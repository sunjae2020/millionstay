import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { formatDateTime } from "@/lib/date";
import { Search, HeadphonesIcon, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Open:       { label: "Open",        color: "bg-blue-100 text-blue-700",   icon: <Clock className="h-3 w-3" /> },
  InProgress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> },
  Resolved:   { label: "Resolved",    color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  Closed:     { label: "Closed",      color: "bg-gray-100 text-gray-500",   icon: <XCircle className="h-3 w-3" /> },
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-blue-50 text-blue-600",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

const CATEGORY_COLORS: Record<string, string> = {
  General:       "bg-purple-100 text-purple-700",
  Accommodation: "bg-orange-100 text-orange-700",
  Billing:       "bg-yellow-100 text-yellow-700",
  Maintenance:   "bg-red-100 text-red-700",
  Other:         "bg-gray-100 text-gray-600",
};

// Who opened the ticket — guest or one of the partner portals.
const REQUESTER_CONFIG: Record<string, { label: string; color: string }> = {
  guest:        { label: "Guest",        color: "bg-sky-100 text-sky-700" },
  agent:        { label: "Agent",        color: "bg-indigo-100 text-indigo-700" },
  owner:        { label: "Owner",        color: "bg-emerald-100 text-emerald-700" },
  service_host: { label: "Service Host", color: "bg-amber-100 text-amber-700" },
};

interface CsTicket {
  id: number;
  ticket_ref: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  requester_type?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  guest_name: string | null;
  guest_email: string | null;
  booking_ref: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchTickets(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  const res = await apiFetch(`/api/v1/cs-tickets${q ? `?${q}` : ""}`);
  return res.json();
}

const STATUSES = ["All", "Open", "InProgress", "Resolved", "Closed"] as const;
const CATEGORIES = ["All", "General", "Accommodation", "Billing", "Maintenance", "Other"] as const;
const REQUESTER_TYPES = ["All", "guest", "agent", "owner", "service_host"] as const;

export default function CsTicketList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [requesterType, setRequesterType] = useState("All");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const { toast } = useToast();

  const params: Record<string, string> = { limit: "500" };
  if (status !== "All") params.status = status;
  if (category !== "All") params.category = category;
  if (requesterType !== "All") params.requester_type = requesterType;
  if (search.trim()) params.q = search.trim();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-cs-tickets", params],
    queryFn: () => fetchTickets(params),
  });

  const tickets: CsTicket[] = data?.data ?? [];
  const pagination = usePagination(tickets, 25);

  const pageIds = pagination.paginatedItems.map((t) => t.id);
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
      const res = await apiFetch("/api/v1/cs-tickets/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      refetch();
      toast({ title: permanent ? `${data.affected} tickets permanently deleted` : `${data.affected} tickets archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const statusCounts = tickets.reduce((acc: Record<string, number>, ticket) => {
    acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
    return acc;
  }, {});

  function handleFilterChange(fn: () => void) {
    fn();
    pagination.setPage(1);
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <HeadphonesIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t("nav.cs_tickets")}</h1>
              <p className="text-sm text-gray-500">{t("csticket.subtitle")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> {t("csticket.refresh")}
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(["Open", "InProgress", "Resolved", "Closed"] as const).map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => handleFilterChange(() => setStatus(status === s ? "All" : s))}
                className={`bg-white rounded-xl border p-3 text-left transition-all ${status === s ? "border-primary shadow-sm" : "border-gray-100 hover:border-gray-200"}`}
              >
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-1.5 ${cfg.color}`}>
                  {cfg.icon}{t(`csticket.summary_${s.toLowerCase() === "inprogress" ? "in_progress" : s.toLowerCase()}` as any)}
                </div>
                <p className="text-2xl font-bold text-gray-900">{statusCounts[s] ?? 0}</p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("csticket.search_placeholder")}
              value={search}
              onChange={e => handleFilterChange(() => setSearch(e.target.value))}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={v => handleFilterChange(() => setStatus(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  {s === "All" ? t("csticket.all_statuses") : t(`csticket.status_${s.toLowerCase() === "inprogress" ? "in_progress" : s.toLowerCase()}` as any)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={v => handleFilterChange(() => setCategory(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c === "All" ? t("csticket.all_categories") : c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={requesterType} onValueChange={v => handleFilterChange(() => setRequesterType(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REQUESTER_TYPES.map(rt => (
                <SelectItem key={rt} value={rt}>{rt === "All" ? t("csticket.all_types", "All types") : (REQUESTER_CONFIG[rt]?.label ?? rt)}</SelectItem>
              ))}
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
        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : pagination.paginatedItems.length === 0 ? (
              <div className="p-12 text-center">
                <HeadphonesIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">{t("csticket.no_tickets")}</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting filters</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {isSuperAdmin && <th className="px-3 py-3 w-8"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></th>}
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">{t("csticket.col_ref")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{t("csticket.col_subject")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell whitespace-nowrap">{t("csticket.col_type", "Type")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell whitespace-nowrap">{t("csticket.col_requester", "Requester")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell whitespace-nowrap">{t("csticket.col_category")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">{t("csticket.col_status")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell whitespace-nowrap">{t("csticket.col_priority")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell whitespace-nowrap">{t("csticket.col_created")}</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedItems.map((ticket, i) => {
                    const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.Open;
                    const sl = (ticket.status ?? "open").toLowerCase();
                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate(`/cs/tickets/${ticket.id}`)}
                        className={`border-b border-gray-50 hover:bg-primary/5 cursor-pointer transition-colors ${i === pagination.paginatedItems.length - 1 ? "border-0" : ""} ${selectedIds.has(ticket.id) ? "bg-orange-50/50" : ""}`}
                      >
                        {isSuperAdmin && <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(ticket.id)} onCheckedChange={() => toggleSelect(ticket.id)} /></td>}
                        <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{ticket.ticket_ref}</td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="font-medium text-gray-900 truncate">{ticket.subject}</p>
                          {ticket.booking_ref && (
                            <p className="text-xs text-gray-400 mt-0.5">{t("csticket.col_booking")}: {ticket.booking_ref}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                          {(() => {
                            const rc = REQUESTER_CONFIG[ticket.requester_type ?? "guest"] ?? REQUESTER_CONFIG.guest;
                            return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>{rc.label}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                          <p className="text-gray-700 text-xs">{ticket.requester_name ?? ticket.guest_name ?? "—"}</p>
                          <p className="text-gray-400 text-xs">{ticket.requester_email ?? ticket.guest_email ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
                            {ticket.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.icon}
                            {t(`csticket.status_${sl === "inprogress" ? "in_progress" : sl}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority ?? ""] ?? ""}`}>
                            {t(`csticket.priority_${(ticket.priority ?? "normal").toLowerCase()}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell whitespace-nowrap">
                          {formatDateTime(ticket.updated_at)}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && tickets.length > 0 && (
            <TablePagination {...pagination} />
          )}
        </div>
      </div>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Tickets" : "Archive Tickets"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} ticket(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} ticket(s). They will be hidden from view.`}
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
