import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { formatDate } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { Layout, PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { GraduationCap, Search, Eye, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-student-requests";
/** 서버가 정렬할 수 있는 컬럼(api-server 의 SortMap 과 1:1). */
const SORTABLE_KEYS = ["request_ref", "student", "student_email", "status", "submitted", "created_at", "updated_at"];

export type StudentStatus =
  | "Draft" | "Submitted" | "UnderReview" | "Matching" | "Proposed"
  | "Confirmed" | "Placed" | "Completed" | "Cancelled" | "Rejected";

export interface StudentPreferences {
  school?: string;
  campus_location?: string;
  homestay_start_date?: string;
  duration_weeks?: string;
  /**
   * Referring agent. The public student form stores an object
   * (`{ uses_agent, agent_name, ... }`); some imports may store a bare string.
   * `agentDisplayName` normalises both for display.
   */
  agent?: { agent_name?: string; [k: string]: unknown } | string;
  /** Import metadata; `ref` holds the original Google Sheets submission timestamp. */
  import?: { ref?: string | null; [k: string]: unknown };
  [k: string]: unknown;
}

export interface StudentRequest {
  id: number;
  request_ref: string;
  status: StudentStatus;
  student_first_name: string;
  student_last_name: string;
  student_email?: string | null;
  is_minor?: boolean;
  nationality?: string | null;
  preferences?: StudentPreferences;
  created_at: string;
}

/** Normalise the agent preference (object or string) to a display string. */
function agentDisplayName(agent: StudentPreferences["agent"]): string {
  if (!agent) return "";
  if (typeof agent === "string") return agent;
  return typeof agent.agent_name === "string" ? agent.agent_name : "";
}

export const STUDENT_STATUS_CONFIG: Record<StudentStatus, { key: string; badge: string; dot: string }> = {
  Draft:      { key: "homestayStudent.status_draft",       badge: "bg-gray-100 text-gray-600 border-gray-200",     dot: "bg-gray-400" },
  Submitted:  { key: "homestayStudent.status_submitted",   badge: "bg-slate-100 text-slate-700 border-slate-200",  dot: "bg-slate-400" },
  UnderReview:{ key: "homestayStudent.status_under_review",badge: "bg-blue-100 text-blue-700 border-blue-200",     dot: "bg-blue-500" },
  Matching:   { key: "homestayStudent.status_matching",    badge: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  Proposed:   { key: "homestayStudent.status_proposed",    badge: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  Confirmed:  { key: "homestayStudent.status_confirmed",   badge: "bg-teal-100 text-teal-700 border-teal-200",     dot: "bg-teal-500" },
  Placed:     { key: "homestayStudent.status_placed",      badge: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500" },
  Completed:  { key: "homestayStudent.status_completed",   badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-600" },
  Cancelled:  { key: "homestayStudent.status_cancelled",   badge: "bg-zinc-100 text-zinc-600 border-zinc-200",     dot: "bg-zinc-400" },
  Rejected:   { key: "homestayStudent.status_rejected",    badge: "bg-red-100 text-red-700 border-red-200",        dot: "bg-red-400" },
};

export const STUDENT_STATUS_ORDER: StudentStatus[] = [
  "Submitted", "UnderReview", "Matching", "Proposed", "Confirmed", "Placed", "Completed", "Cancelled", "Rejected",
];

export function StudentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = STUDENT_STATUS_CONFIG[status as StudentStatus];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.badge ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
      {cfg ? t(cfg.key) : status}
    </span>
  );
}

export default function HomestayStudentRequests() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | StudentStatus>("");

  const setSearch = (v: string) => setQ(v);
  const setStatusFilter = (v: "" | StudentStatus) => setStatus(v);

  const { rows: requests, total, isLoading, server } = useServerList<StudentRequest>(API, {
    filters: { q: q || undefined, status: status || undefined },
    sortableKeys: SORTABLE_KEYS,
    defaultSort: { key: "created_at", dir: "desc" },
  });

  const columns: ColumnDef<StudentRequest>[] = useMemo(
    () => [
      {
        key: "request_ref",
        header: "homestayStudent.col_ref",
        hideable: false,
        defaultWidth: 150,
        cell: (r) => (
          <Link href={`/account/homestay-student-requests/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {r.request_ref}
          </Link>
        ),
      },
      {
        key: "student",
        header: "homestayStudent.col_student",
        sortAccessor: (r) => formatPersonName(r.student_first_name, r.student_last_name),
        cell: (r) => (
          <Link href={`/account/homestay-student-requests/${r.id}`} className="font-medium hover:underline inline-flex items-center gap-1.5">
            {formatPersonName(r.student_first_name, r.student_last_name)}
            {r.is_minor && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5" title={t("homestayStudent.minor")}>
                <ShieldCheck className="h-3 w-3" /> {t("homestayStudent.minor_short")}
              </span>
            )}
          </Link>
        ),
      },
      {
        key: "student_email",
        header: "homestayStudent.col_email",
        cell: (r) => <span className="text-sm text-muted-foreground">{r.student_email || <span className="text-muted-foreground/40">—</span>}</span>,
      },
      {
        key: "school",
        header: "homestayStudent.col_school",
        sortAccessor: (r) => r.preferences?.school ?? "",
        cell: (r) => <span className="text-sm text-muted-foreground">{r.preferences?.school || <span className="text-muted-foreground/40">—</span>}</span>,
      },
      {
        key: "agent",
        header: "homestayStudent.col_agent",
        sortAccessor: (r) => agentDisplayName(r.preferences?.agent),
        cell: (r) => <span className="text-sm text-muted-foreground">{agentDisplayName(r.preferences?.agent) || <span className="text-muted-foreground/40">—</span>}</span>,
      },
      {
        key: "start",
        header: "homestayStudent.col_start",
        sortAccessor: (r) => r.preferences?.homestay_start_date ?? "",
        cell: (r) => <span className="text-sm text-muted-foreground">{r.preferences?.homestay_start_date ? formatDate(r.preferences.homestay_start_date) : <span className="text-muted-foreground/40">—</span>}</span>,
      },
      {
        key: "status",
        header: "homestayStudent.col_status",
        cell: (r) => <StudentStatusBadge status={r.status} />,
      },
      {
        key: "submitted",
        header: "homestayStudent.col_submitted",
        sortAccessor: (r) => r.preferences?.import?.ref || r.created_at,
        cell: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.preferences?.import?.ref || r.created_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (r) => (
          <Link href={`/account/homestay-student-requests/${r.id}`}>
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
        title={<><GraduationCap className="h-5 w-5" />{t("homestayStudent.list_title")}</>}
        subtitle={t("homestayStudent.list_subtitle")}
      />

      <div className="px-6 py-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === "" ? "bg-primary/15 text-primary border-primary/20" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              {t("homestayStudent.filter_all")}
            </button>
            {STUDENT_STATUS_ORDER.map((s) => {
              const cfg = STUDENT_STATUS_CONFIG[s];
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
            server={server}
            tableKey="homestay-student-requests"
            columns={columns}
            data={requests}
            isLoading={isLoading}
            rowKey={(r) => r.id}
            emptyText={t("homestayStudent.empty")}
            toolbarExtra={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t("homestayStudent.search_placeholder")}
                    value={q}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            }
          />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {total} {t("homestayStudent.count_label")}
        </p>
      </div>
    </Layout>
  );
}
