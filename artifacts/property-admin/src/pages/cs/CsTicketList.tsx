import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, HeadphonesIcon, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw, ChevronLeft } from "lucide-react";

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

interface CsTicket {
  id: number;
  ticket_ref: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
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
const PAGE_SIZE = 20;

export default function CsTicketList() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { limit: "500" };
  if (status !== "All") params.status = status;
  if (category !== "All") params.category = category;
  if (search.trim()) params.q = search.trim();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-cs-tickets", params],
    queryFn: () => fetchTickets(params),
  });

  const tickets: CsTicket[] = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = tickets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const statusCounts = tickets.reduce((acc: Record<string, number>, ticket) => {
    acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
    return acc;
  }, {});

  function handleFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 flex flex-col h-full">
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
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : paged.length === 0 ? (
              <div className="p-12 text-center">
                <HeadphonesIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">{t("csticket.no_tickets")}</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting filters</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">{t("csticket.col_ref")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{t("csticket.col_subject")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell whitespace-nowrap">{t("csticket.col_guest")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell whitespace-nowrap">{t("csticket.col_category")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">{t("csticket.col_status")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell whitespace-nowrap">{t("csticket.col_priority")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell whitespace-nowrap">{t("csticket.col_created")}</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((ticket, i) => {
                    const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.Open;
                    const sl = (ticket.status ?? "open").toLowerCase();
                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate(`/cs/tickets/${ticket.id}`)}
                        className={`border-b border-gray-50 hover:bg-primary/5 cursor-pointer transition-colors ${i === paged.length - 1 ? "border-0" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{ticket.ticket_ref}</td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="font-medium text-gray-900 truncate">{ticket.subject}</p>
                          {ticket.booking_ref && (
                            <p className="text-xs text-gray-400 mt-0.5">{t("csticket.col_booking")}: {ticket.booking_ref}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                          <p className="text-gray-700 text-xs">{ticket.guest_name ?? "—"}</p>
                          <p className="text-gray-400 text-xs">{ticket.guest_email ?? ""}</p>
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
                          {format(new Date(ticket.updated_at), "dd/MM/yy HH:mm")}
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

          {/* Pagination footer */}
          {!isLoading && tickets.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
              <p className="text-xs text-gray-500">
                {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, tickets.length)} / {tickets.length}건
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">…</span>
                    ) : (
                      <Button
                        key={item}
                        variant={item === safePage ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(item as number)}
                      >
                        {item}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
