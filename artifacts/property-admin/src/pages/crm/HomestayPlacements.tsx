import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { formatDate } from "@/lib/date";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Handshake, Eye, Search } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-placements";
const FETCH_LIMIT = 1000;

export type PlacementStatus =
  | "Proposed" | "HostAccepted" | "AwaitingPayment" | "Active"
  | "Ending" | "Completed" | "Cancelled" | "Terminated";

export interface Placement {
  id: number;
  placement_ref: string;
  status: PlacementStatus;
  host_name?: string | null;
  host_suburb?: string | null;
  student_name?: string | null;
  student_is_minor?: boolean;
  move_in_date?: string | null;
  move_out_date?: string | null;
  currency?: string;
  placement_fee?: string;
  monthly_fee?: string;
  created_at: string;
}

export const PLACEMENT_STATUS_CONFIG: Record<PlacementStatus, { key: string; badge: string; dot: string }> = {
  Proposed:       { key: "homestayPlacement.status_proposed",        badge: "bg-violet-100 text-violet-700 border-violet-200",  dot: "bg-violet-500" },
  HostAccepted:   { key: "homestayPlacement.status_host_accepted",   badge: "bg-blue-100 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  AwaitingPayment:{ key: "homestayPlacement.status_awaiting_payment",badge: "bg-amber-100 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  Active:         { key: "homestayPlacement.status_active",          badge: "bg-green-100 text-green-700 border-green-200",     dot: "bg-green-500" },
  Ending:         { key: "homestayPlacement.status_ending",          badge: "bg-orange-100 text-orange-700 border-orange-200",  dot: "bg-orange-500" },
  Completed:      { key: "homestayPlacement.status_completed",       badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-600" },
  Cancelled:      { key: "homestayPlacement.status_cancelled",       badge: "bg-zinc-100 text-zinc-600 border-zinc-200",        dot: "bg-zinc-400" },
  Terminated:     { key: "homestayPlacement.status_terminated",      badge: "bg-red-100 text-red-700 border-red-200",           dot: "bg-red-400" },
};

export const PLACEMENT_STATUS_ORDER: PlacementStatus[] = [
  "Proposed", "HostAccepted", "AwaitingPayment", "Active", "Ending", "Completed", "Cancelled", "Terminated",
];

export function PlacementStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = PLACEMENT_STATUS_CONFIG[status as PlacementStatus];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.badge ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
      {cfg ? t(cfg.key) : status}
    </span>
  );
}

async function fetchPlacements(
  q: string,
  status: string,
): Promise<{ items: Placement[]; total: number }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set("limit", String(FETCH_LIMIT));
  params.set("offset", "0");
  const res = await apiFetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load placements");
  const json = await res.json();
  const items = (json.data ?? []) as Placement[];
  return { items, total: json.meta?.total ?? items.length };
}

export default function HomestayPlacements() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | PlacementStatus>("");

  const setSearch = (v: string) => setQ(v);
  const setStatusFilter = (v: "" | PlacementStatus) => setStatus(v);

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-placements", q, status],
    queryFn: () => fetchPlacements(q, status),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? rows.length;

  const columns: ColumnDef<Placement>[] = useMemo(
    () => [
      {
        key: "placement_ref",
        header: "homestayPlacement.col_ref",
        hideable: false,
        defaultWidth: 150,
        cell: (r) => (
          <Link href={`/account/homestay-placements/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {r.placement_ref}
          </Link>
        ),
      },
      {
        key: "student_name",
        header: "homestayPlacement.col_student",
        cell: (r) => (
          <Link href={`/account/homestay-placements/${r.id}`} className="font-medium hover:underline">
            {r.student_name || "—"}
          </Link>
        ),
      },
      {
        key: "host_name",
        header: "homestayPlacement.col_host",
        cell: (r) => <span className="text-sm text-muted-foreground">{r.host_name || "—"}{r.host_suburb ? ` · ${r.host_suburb}` : ""}</span>,
      },
      {
        key: "move_in_date",
        header: "homestayPlacement.col_move_in",
        cell: (r) => <span className="text-sm text-muted-foreground">{r.move_in_date || <span className="text-muted-foreground/40">—</span>}</span>,
      },
      {
        key: "status",
        header: "homestayPlacement.col_status",
        cell: (r) => <PlacementStatusBadge status={r.status} />,
      },
      {
        key: "created_at",
        header: "homestayPlacement.col_created",
        sortAccessor: (r) => r.created_at,
        cell: (r) => <span className="text-sm text-muted-foreground">{r.created_at ? formatDate(r.created_at) : "—"}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (r) => (
          <Link href={`/account/homestay-placements/${r.id}`}>
            <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t("common.view")}</Button>
          </Link>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={<><Handshake className="h-5 w-5" />{t("homestayPlacement.list_title")}</>}
        subtitle={t("homestayPlacement.list_subtitle")}
      />

      <div className="px-6 py-6">
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("homestayPlacement.search_placeholder", "Search placement ref…")}
            value={q}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              status === "" ? "bg-primary/15 text-primary border-primary/20" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            {t("homestayPlacement.filter_all")}
          </button>
          {PLACEMENT_STATUS_ORDER.map((s) => {
            const cfg = PLACEMENT_STATUS_CONFIG[s];
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active ? cfg.badge : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {t(cfg.key)}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <DataTable
            tableKey="homestay-placements"
            columns={columns}
            data={rows}
            isLoading={isLoading}
            rowKey={(r) => r.id}
            emptyText={t("homestayPlacement.empty")}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {total} {t("homestayPlacement.count_label")}
        </p>
      </div>
    </Layout>
  );
}
