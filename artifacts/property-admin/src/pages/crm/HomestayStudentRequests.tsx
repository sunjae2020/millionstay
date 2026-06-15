import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { formatDate } from "@/lib/date";
import { formatPersonName } from "@/lib/nameFormat";
import { Layout, PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/TablePagination";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { GraduationCap, Search, Eye, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-student-requests";
const PAGE_SIZE = 25;

export type StudentStatus =
  | "Draft" | "Submitted" | "UnderReview" | "Matching" | "Proposed"
  | "Confirmed" | "Placed" | "Completed" | "Cancelled" | "Rejected";

export interface StudentPreferences {
  school?: string;
  campus_location?: string;
  homestay_start_date?: string;
  duration_weeks?: string;
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

async function fetchRequests(
  q: string,
  status: string,
  page: number,
  pageSize: number,
): Promise<{ items: StudentRequest[]; total: number }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set("limit", String(pageSize));
  params.set("offset", String((page - 1) * pageSize));
  const res = await apiFetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load student requests");
  const json = await res.json();
  const items = (json.data ?? []) as StudentRequest[];
  return { items, total: json.meta?.total ?? items.length };
}

export default function HomestayStudentRequests() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | StudentStatus>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const setSearch = (v: string) => { setQ(v); setPage(1); };
  const setStatusFilter = (v: "" | StudentStatus) => { setStatus(v); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ["homestay-student-requests", q, status, page, pageSize],
    queryFn: () => fetchRequests(q, status, page, pageSize),
    placeholderData: keepPreviousData,
  });
  const requests = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Layout>
      <PageHeader
        title={<><GraduationCap className="h-5 w-5" />{t("homestayStudent.list_title")}</>}
        subtitle={t("homestayStudent.list_subtitle")}
      />

      <div className="px-6 py-6">
        <div className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("homestayStudent.search_placeholder")}
              value={q}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === "" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
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

        <div className="border rounded-lg bg-white mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("homestayStudent.col_ref")}</TableHead>
                <TableHead>{t("homestayStudent.col_student")}</TableHead>
                <TableHead>{t("homestayStudent.col_email")}</TableHead>
                <TableHead>{t("homestayStudent.col_school")}</TableHead>
                <TableHead>{t("homestayStudent.col_start")}</TableHead>
                <TableHead>{t("homestayStudent.col_status")}</TableHead>
                <TableHead>{t("homestayStudent.col_submitted")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("homestayStudent.empty")}</TableCell></TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/account/homestay-student-requests/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {r.request_ref}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/account/homestay-student-requests/${r.id}`} className="font-medium hover:underline inline-flex items-center gap-1.5">
                      {formatPersonName(r.student_first_name, r.student_last_name)}
                      {r.is_minor && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5" title={t("homestayStudent.minor")}>
                          <ShieldCheck className="h-3 w-3" /> {t("homestayStudent.minor_short")}
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.student_email || <span className="text-muted-foreground/40">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.preferences?.school || <span className="text-muted-foreground/40">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.preferences?.homestay_start_date || <span className="text-muted-foreground/40">—</span>}</TableCell>
                  <TableCell><StudentStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.created_at ? formatDate(r.created_at) : "—"}</TableCell>
                  <TableCell>
                    <Link href={`/account/homestay-student-requests/${r.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t("common.view")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            hasNext={page < totalPages}
            hasPrev={page > 1}
            onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {total} {t("homestayStudent.count_label")}
        </p>
      </div>
    </Layout>
  );
}
