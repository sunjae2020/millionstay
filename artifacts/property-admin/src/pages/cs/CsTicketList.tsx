import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/date";
import { Search, HeadphonesIcon, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";

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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [requesterType, setRequesterType] = useState("All");
  const [showDeleted, setShowDeleted] = useState(false);

  const params: Record<string, string> = { limit: "500" };
  if (status !== "All") params.status = status;
  if (category !== "All") params.category = category;
  if (requesterType !== "All") params.requester_type = requesterType;
  if (search.trim()) params.q = search.trim();
  if (showDeleted) params.deleted = "only";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-cs-tickets", params],
    queryFn: () => fetchTickets(params),
  });

  const tickets: CsTicket[] = data?.data ?? [];

  const statusCounts = tickets.reduce((acc: Record<string, number>, ticket) => {
    acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
    return acc;
  }, {});

  const columns: ColumnDef<CsTicket>[] = useMemo(
    () => [
      {
        key: "ticket_ref",
        header: "csticket.col_ref",
        cell: (ticket) => (
          <Link href={`/cs/tickets/${ticket.id}`} className="font-mono text-xs text-gray-400 hover:text-primary hover:underline whitespace-nowrap">{ticket.ticket_ref}</Link>
        ),
      },
      {
        key: "subject",
        header: "csticket.col_subject",
        hideable: false,
        cell: (ticket) => (
          <Link href={`/cs/tickets/${ticket.id}`} className="block max-w-[220px]">
            <p className="font-medium text-gray-900 truncate hover:underline">{ticket.subject}</p>
            {ticket.booking_ref && (
              <p className="text-xs text-gray-400 mt-0.5">{t("csticket.col_booking")}: {ticket.booking_ref}</p>
            )}
          </Link>
        ),
      },
      {
        key: "requester_type",
        header: "csticket.col_type",
        cell: (ticket) => {
          const rc = REQUESTER_CONFIG[ticket.requester_type ?? "guest"] ?? REQUESTER_CONFIG.guest;
          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>{rc.label}</span>;
        },
      },
      {
        key: "requester_display",
        header: "csticket.col_requester",
        sortAccessor: (ticket) => ticket.requester_name ?? ticket.guest_name,
        cell: (ticket) => (
          <div className="whitespace-nowrap">
            <p className="text-gray-700 text-xs">{ticket.requester_name ?? ticket.guest_name ?? "—"}</p>
            <p className="text-gray-400 text-xs">{ticket.requester_email ?? ticket.guest_email ?? ""}</p>
          </div>
        ),
      },
      {
        key: "category",
        header: "csticket.col_category",
        cell: (ticket) => (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
            {ticket.category}
          </span>
        ),
      },
      {
        key: "status",
        header: "csticket.col_status",
        editable: {
          type: "select",
          getValue: (ticket) => ticket.status,
          options: ["Open", "InProgress", "Resolved", "Closed"].map((s) => ({
            value: s,
            label: t(`csticket.status_${s.toLowerCase() === "inprogress" ? "in_progress" : s.toLowerCase()}` as any),
          })),
        },
        cell: (ticket) => {
          const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.Open;
          const sl = (ticket.status ?? "open").toLowerCase();
          return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
              {st.icon}
              {t(`csticket.status_${sl === "inprogress" ? "in_progress" : sl}` as any)}
            </span>
          );
        },
      },
      {
        key: "priority",
        header: "csticket.col_priority",
        editable: {
          type: "select",
          getValue: (ticket) => ticket.priority,
          options: ["Low", "Normal", "High", "Urgent"].map((p) => ({
            value: p,
            label: t(`csticket.priority_${p.toLowerCase()}` as any),
          })),
        },
        cell: (ticket) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority ?? ""] ?? ""}`}>
            {t(`csticket.priority_${(ticket.priority ?? "normal").toLowerCase()}` as any)}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: "csticket.col_created",
        sortAccessor: (ticket) => ticket.updated_at,
        cell: (ticket) => <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(ticket.updated_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 60,
        cell: (ticket) => (
          <Link href={`/cs/tickets/${ticket.id}`} className="inline-flex justify-end">
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </Link>
        ),
      },
    ],
    [t],
  );

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
                onClick={() => setStatus(status === s ? "All" : s)}
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

        <DataTable
          tableKey="cs-tickets"
          columns={columns}
          data={tickets}
          isLoading={isLoading}
          rowKey={(ticket) => ticket.id}
          defaultPageSize={25}
          emptyText={t("csticket.no_tickets")}
          selection={{
            enable: true,
            resource: "cs-tickets",
            onChanged: () => refetch(),
          }}
          editing={{ resource: "cs-tickets", onEdited: () => refetch() }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t("csticket.search_placeholder")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {s === "All" ? t("csticket.all_statuses") : t(`csticket.status_${s.toLowerCase() === "inprogress" ? "in_progress" : s.toLowerCase()}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c === "All" ? t("csticket.all_categories") : c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={requesterType} onValueChange={setRequesterType}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUESTER_TYPES.map(rt => (
                    <SelectItem key={rt} value={rt}>{rt === "All" ? t("csticket.all_types", "All types") : (REQUESTER_CONFIG[rt]?.label ?? rt)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
      </div>
    </Layout>
  );
}
