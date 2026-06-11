import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Home, Search, Eye, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const API = "/api/v1/homestay-applications";

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

async function fetchApplications(q: string, status: string): Promise<HomestayApplication[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const res = await apiFetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load applications");
  const json = await res.json();
  return (json.data ?? []) as HomestayApplication[];
}

export default function HomestayApplications() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | HomestayStatus>("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["homestay-applications", q, status],
    queryFn: () => fetchApplications(q, status),
  });

  return (
    <Layout>
      <PageHeader
        title={<><Home className="h-5 w-5" />{t("homestay.list_title")}</>}
        subtitle={t("homestay.list_subtitle")}
      />

      <div className="px-6 py-6">
        <div className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("homestay.search_placeholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatus("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === "" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white text-muted-foreground border-border hover:bg-muted/50"
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
                  onClick={() => setStatus(s)}
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
                <TableHead>{t("homestay.col_ref")}</TableHead>
                <TableHead>{t("homestay.col_host")}</TableHead>
                <TableHead>{t("homestay.col_email")}</TableHead>
                <TableHead>{t("homestay.col_suburb")}</TableHead>
                <TableHead>{t("homestay.col_status")}</TableHead>
                <TableHead>{t("homestay.col_submitted")}</TableHead>
                <TableHead>{t("homestay.col_landing")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : applications.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("homestay.empty")}</TableCell></TableRow>
              ) : applications.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/account/homestay-applications/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      {a.application_ref}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/account/homestay-applications/${a.id}`} className="font-medium hover:underline">
                      {a.first_name} {a.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.suburb || <span className="text-muted-foreground/40">—</span>}</TableCell>
                  <TableCell><HomestayStatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {a.landing_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("homestay.landing_live")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">{t("homestay.landing_off")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/account/homestay-applications/${a.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t("common.view")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {applications.length} {t("homestay.count_label")}
        </p>
      </div>
    </Layout>
  );
}
