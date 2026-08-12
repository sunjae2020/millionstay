import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { formatDate } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { Layout, PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Home, Search, Eye, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-applications";
const FETCH_LIMIT = 1000;

export type HomestayStatus = "Submitted" | "UnderReview" | "DocsRequested" | "Approved" | "Rejected";

export interface HomestayApplication {
  id: number;
  application_ref: string;
  status: HomestayStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  suburb?: string | null;
  landing_active?: boolean;
  created_at: string;
}

export const HOMESTAY_STATUS_CONFIG: Record<
  HomestayStatus,
  { key: string; badge: string; dot: string }
> = {
  Submitted:     { key: "homestay.status_submitted",      badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  UnderReview:   { key: "homestay.status_under_review",   badge: "bg-blue-100 text-blue-700 border-blue-200",    dot: "bg-blue-500" },
  DocsRequested: { key: "homestay.status_docs_requested", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  Approved:      { key: "homestay.status_approved",       badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  Rejected:      { key: "homestay.status_rejected",       badge: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-400" },
};

const STATUS_ORDER: HomestayStatus[] = ["Submitted", "UnderReview", "DocsRequested", "Approved", "Rejected"];

export function HomestayStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = HOMESTAY_STATUS_CONFIG[status as HomestayStatus];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.badge ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
      {cfg ? t(cfg.key) : status}
    </span>
  );
}

async function fetchApplications(
  q: string,
  status: string,
): Promise<{ items: HomestayApplication[]; total: number }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set("limit", String(FETCH_LIMIT));
  params.set("offset", "0");
  const res = await apiFetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load applications");
  const json = await res.json();
  const items = (json.data ?? []) as HomestayApplication[];
  return { items, total: json.meta?.total ?? items.length };
}

export default function HomestayApplications() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | HomestayStatus>("");

  const setSearch = (v: string) => setQ(v);
  const setStatusFilter = (v: "" | HomestayStatus) => setStatus(v);

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-applications", q, status],
    queryFn: () => fetchApplications(q, status),
    placeholderData: keepPreviousData,
  });
  const applications = data?.items ?? [];
  const total = data?.total ?? applications.length;

  const columns: ColumnDef<HomestayApplication>[] = useMemo(
    () => [
      {
        key: "application_ref",
        header: "homestay.col_ref",
        hideable: false,
        defaultWidth: 150,
        cell: (a) => (
          <Link href={`/account/homestay-applications/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {a.application_ref}
          </Link>
        ),
      },
      {
        key: "host",
        header: "homestay.col_host",
        sortAccessor: (a) => formatPersonName(a.first_name, a.last_name),
        cell: (a) => (
          <Link href={`/account/homestay-applications/${a.id}`} className="font-medium hover:underline">
            {formatPersonName(a.first_name, a.last_name)}
          </Link>
        ),
      },
      {
        key: "email",
        header: "homestay.col_email",
        cell: (a) => <span className="text-sm text-muted-foreground">{a.email}</span>,
      },
      {
        key: "suburb",
        header: "homestay.col_suburb",
        cell: (a) => <span className="text-sm text-muted-foreground">{a.suburb || <span className="text-muted-foreground/40">—</span>}</span>,
      },
      {
        key: "status",
        header: "homestay.col_status",
        cell: (a) => <HomestayStatusBadge status={a.status} />,
      },
      {
        key: "created_at",
        header: "homestay.col_submitted",
        sortAccessor: (a) => a.created_at,
        cell: (a) => <span className="text-sm text-muted-foreground">{a.created_at ? formatDate(a.created_at) : "—"}</span>,
      },
      {
        key: "landing_active",
        header: "homestay.col_landing",
        cell: (a) =>
          a.landing_active ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("homestay.landing_live")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">{t("homestay.landing_off")}</span>
          ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (a) => (
          <Link href={`/account/homestay-applications/${a.id}`}>
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
        title={<><Home className="h-5 w-5" />{t("homestay.list_title")}</>}
        subtitle={t("homestay.list_subtitle")}
      />

      <div className="px-6 py-6">
        <div className="flex flex-col gap-4">
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === "" ? "bg-primary/15 text-primary border-primary/20" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              {t("homestay.filter_all")}
            </button>
            {STATUS_ORDER.map((s) => {
              const cfg = HOMESTAY_STATUS_CONFIG[s];
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
        </div>

        <div className="mt-4">
          <DataTable
            tableKey="homestay-applications"
            columns={columns}
            data={applications}
            isLoading={isLoading}
            rowKey={(a) => a.id}
            emptyText={t("homestay.empty")}
            toolbarExtra={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t("homestay.search_placeholder")}
                    value={q}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            }
          />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {total} {t("homestay.count_label")}
        </p>
      </div>
    </Layout>
  );
}
