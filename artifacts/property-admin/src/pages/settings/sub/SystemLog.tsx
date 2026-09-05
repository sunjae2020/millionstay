import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { ALL, SearchBox, DateRangeFilter, ResetFiltersButton } from "@/components/list-filters";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, BarChart3, RefreshCw } from "lucide-react";

/**
 * 시스템 로그 — 감사 원장(system_log)과 활동 로그(user_activity_log)를 하나의
 * 피드로 본다. 정렬·페이징·CSV 는 전부 서버가 하고, 이 화면은 필터와 표시만
 * 맡는다(공용 DataTable 규약).
 */

/* ── 서버 응답(routes/system-logs.ts 와 1:1) ─────────────────────────────── */
export interface LogRow {
  source: "audit" | "activity";
  id: number;
  logged_at: string;
  actor_id: number | null;
  actor_email: string | null;
  actor_role: string | null;
  actor_type: string | null;
  actor_first_name: string | null;
  actor_last_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  duration_ms: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  branch_name: string | null;
  team_name: string | null;
  /** IP 기반 예상 지역. 조회 실패·사설망이면 null. */
  ip_geo: IpGeo | null;
}

export interface IpGeo {
  country_code: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
}

interface Facets {
  actors: Array<{ id: number; email: string; first_name: string; last_name: string; role: string }>;
  branches: Array<{ id: number; name: string }>;
  teams: Array<{ id: number; name: string; branch_id: number }>;
  actions: string[];
  resource_types: string[];
}

/** 액션 배지 색. 없는 액션은 회색으로 떨어진다(새 액션이 생겨도 화면은 안 깨진다). */
const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  STATUS_CHANGE: "bg-amber-100 text-amber-700",
  LOGIN: "bg-emerald-100 text-emerald-700",
  LOGOUT: "bg-gray-100 text-gray-600",
  LOGIN_FAILED: "bg-rose-100 text-rose-700",
  VIEW: "bg-slate-100 text-slate-700",
  DOWNLOAD: "bg-purple-100 text-purple-700",
  EXPORT: "bg-indigo-100 text-indigo-700",
  DOC_ISSUE: "bg-teal-100 text-teal-700",
  SEND_EMAIL: "bg-sky-100 text-sky-700",
  AI_CALL: "bg-fuchsia-100 text-fuchsia-700",
  OCR_RUN: "bg-amber-100 text-amber-700",
  IMPORT: "bg-orange-100 text-orange-700",
  PAYMENT: "bg-lime-100 text-lime-700",
};

export function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-gray-100 text-gray-600";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{action}</span>;
}

export function actorName(row: { actor_first_name?: string | null; actor_last_name?: string | null; actor_email?: string | null }): string {
  const full = [row.actor_last_name, row.actor_first_name].filter(Boolean).join("");
  return full || row.actor_email || "—";
}

/** 바뀐 필드 목록 — 전·후 값을 비교해 실제로 달라진 키만 남긴다. */
export function changedFields(row: Pick<LogRow, "old_value" | "new_value">): string[] {
  const before = (row.old_value ?? {}) as Record<string, unknown>;
  const after = (row.new_value ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

/**
 * 예상 지역 한 줄. 국가 이름은 브라우저의 지역 이름표(Intl.DisplayNames)로 현재 언어에
 * 맞춰 옮기고, 도시는 조회 서비스가 준 표기를 그대로 쓴다 — 도시명까지 번역할 사전이
 * 없는데 억지로 옮기면 틀린 이름이 나온다.
 */
export function formatIpRegion(geo: IpGeo | null | undefined, lang: string): string | null {
  if (!geo) return null;
  let country = geo.country ?? null;
  if (geo.country_code) {
    try {
      country = new Intl.DisplayNames([lang], { type: "region" }).of(geo.country_code) ?? country;
    } catch {
      // 지원하지 않는 언어 태그 — 조회 서비스가 준 영문 국가명을 그대로 쓴다.
    }
  }
  const city = geo.city ?? geo.region ?? null;
  const parts = [country, city].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const SORTABLE_KEYS = ["logged_at", "action", "actor_email", "resource_type", "source"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function SystemLogPage() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [source, setSource] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [resourceType, setResourceType] = useState(ALL);
  const [actorId, setActorId] = useState(ALL);
  const [branchId, setBranchId] = useState(ALL);
  const [teamId, setTeamId] = useState(ALL);
  const [dateFrom, setDateFrom] = useState(daysAgoISO(13));
  const [dateTo, setDateTo] = useState(todayISO());
  const [selected, setSelected] = useState<LogRow | null>(null);

  const filters = {
    q: q || undefined,
    source: source === ALL ? undefined : source,
    action: action === ALL ? undefined : action,
    resource_type: resourceType === ALL ? undefined : resourceType,
    actor_id: actorId === ALL ? undefined : actorId,
    branch_id: branchId === ALL ? undefined : branchId,
    team_id: teamId === ALL ? undefined : teamId,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  };

  const { data: facets } = useQuery<Facets>({
    queryKey: ["system-log-facets"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/system-logs/facets");
      if (!res.ok) throw new Error("facets");
      return (await res.json()).data as Facets;
    },
  });

  const { rows, isLoading, server, invalidate } = useServerList<LogRow>("/api/v1/system-logs", {
    filters,
    sortableKeys: SORTABLE_KEYS,
    defaultSort: { key: "logged_at", dir: "desc" },
    defaultPageSize: 50,
  });

  // 일자별 건수 — 기간 안에서 활동이 몰린 날을 먼저 보여 준다.
  const summaryQs = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, String(v));
    return p.toString();
  }, [q, source, action, resourceType, actorId, branchId, teamId, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: summary } = useQuery<{ by_day: Array<{ date: string; count: number; actors: number }> }>({
    queryKey: ["system-log-summary", summaryQs],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/system-logs/summary?${summaryQs}`);
      if (!res.ok) throw new Error("summary");
      return (await res.json()).data;
    },
  });

  const teamOptions = useMemo(() => {
    const all = facets?.teams ?? [];
    if (branchId === ALL) return all;
    return all.filter((tm) => String(tm.branch_id) === branchId);
  }, [facets, branchId]);

  const hasFilters =
    !!q || source !== ALL || action !== ALL || resourceType !== ALL ||
    actorId !== ALL || branchId !== ALL || teamId !== ALL;

  const resetFilters = () => {
    setQ(""); setSource(ALL); setAction(ALL); setResourceType(ALL);
    setActorId(ALL); setBranchId(ALL); setTeamId(ALL);
  };

  const columns: ColumnDef<LogRow>[] = useMemo(
    () => [
      {
        key: "logged_at",
        header: "system_log.col_time",
        defaultWidth: 150,
        hideable: false,
        cell: (r) => (
          <button
            type="button"
            className="whitespace-nowrap text-left text-primary hover:underline"
            onClick={() => setSelected(r)}
          >
            {formatDateTime(r.logged_at)}
          </button>
        ),
        csv: (r) => r.logged_at,
      },
      {
        key: "source",
        header: "system_log.col_source",
        defaultWidth: 90,
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.source === "audit" ? t("system_log.source_audit") : t("system_log.source_activity")}
          </span>
        ),
      },
      {
        key: "actor_email",
        header: "system_log.col_actor",
        defaultWidth: 180,
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{actorName(r)}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {r.actor_email ?? (r.actor_type === "System" ? t("system_log.actor_system") : "—")}
            </div>
          </div>
        ),
        csv: (r) => r.actor_email ?? r.actor_type ?? "",
      },
      {
        key: "action",
        header: "system_log.col_action",
        defaultWidth: 130,
        cell: (r) => <ActionBadge action={r.action} />,
        csv: (r) => r.action,
      },
      {
        key: "resource_type",
        header: "system_log.col_resource",
        defaultWidth: 160,
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate">{r.resource_type ?? "—"}</div>
            {r.resource_id != null && <div className="text-[11px] text-muted-foreground">#{r.resource_id}</div>}
          </div>
        ),
        csv: (r) => (r.resource_id != null ? `${r.resource_type ?? ""}#${r.resource_id}` : (r.resource_type ?? "")),
      },
      {
        key: "detail",
        header: "system_log.col_detail",
        sortable: false,
        cell: (r) => {
          if (r.source === "audit") {
            const fields = changedFields(r);
            if (fields.length === 0) return <span className="text-muted-foreground">—</span>;
            return (
              <span className="text-[11px]">
                {t("system_log.changed_prefix")} {fields.slice(0, 4).join(", ")}
                {fields.length > 4 ? ` +${fields.length - 4}` : ""}
              </span>
            );
          }
          return (
            <span className="truncate text-[11px] text-muted-foreground">
              {r.method} {r.path}
              {r.status_code ? ` · ${r.status_code}` : ""}
              {r.duration_ms != null ? ` · ${r.duration_ms}ms` : ""}
            </span>
          );
        },
        csv: (r) =>
          r.source === "audit"
            ? changedFields(r).join(" ")
            : [r.method, r.path, r.status_code].filter(Boolean).join(" "),
      },
      {
        key: "team_name",
        header: "system_log.col_org",
        defaultWidth: 140,
        sortable: false,
        defaultHidden: true,
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {[r.branch_name, r.team_name].filter(Boolean).join(" · ") || "—"}
          </span>
        ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        sortable: false,
        defaultWidth: 80,
        exportable: false,
        cell: (r) => (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelected(r)}>
            {t("system_log.view_detail")}
          </Button>
        ),
      },
      {
        key: "ip_address",
        header: "system_log.col_ip",
        defaultWidth: 150,
        sortable: false,
        defaultHidden: true,
        cell: (r) => {
          const region = formatIpRegion(r.ip_geo, i18n.language);
          return (
            <div className="min-w-0">
              <div className="truncate text-[11px] text-muted-foreground">{r.ip_address ?? "—"}</div>
              {region && (
                <div className="truncate text-[11px] text-muted-foreground/80" title={t("system_log.ip_region_note")}>
                  {region}
                </div>
              )}
            </div>
          );
        },
        csv: (r) => [r.ip_address, formatIpRegion(r.ip_geo, i18n.language)].filter(Boolean).join(" "),
      },
    ],
    [t, i18n.language],
  );

  const chartData = (summary?.by_day ?? []).map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <Activity className="h-4 w-4 text-primary" />
            {t("system_log.title")}
          </>
        }
        subtitle={t("system_log.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => invalidate()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {t("common.refresh")}
            </Button>
            <Link href="/settings/activity-analytics">
              <Button size="sm">
                <BarChart3 className="mr-1 h-4 w-4" />
                {t("system_log.open_analytics")}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {chartData.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{t("system_log.daily_count")}</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="count" name={t("system_log.daily_count")} fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <DataTable
          tableKey="system-logs"
          columns={columns}
          data={rows}
          server={server}
          isLoading={isLoading}
          rowKey={(r) => `${r.source}-${r.id}`}
          emptyText={t("system_log.empty")}
          exportFileName="system-log"
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder={t("system_log.search_placeholder")} />
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("system_log.all_sources")}</SelectItem>
                  <SelectItem value="audit">{t("system_log.source_audit")}</SelectItem>
                  <SelectItem value="activity">{t("system_log.source_activity")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("system_log.all_actions")}</SelectItem>
                  {(facets?.actions ?? []).map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("system_log.all_resources")}</SelectItem>
                  {(facets?.resource_types ?? []).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actorId} onValueChange={setActorId}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("system_log.all_actors")}</SelectItem>
                  {(facets?.actors ?? []).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {[u.last_name, u.first_name].filter(Boolean).join("") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={branchId} onValueChange={(v) => { setBranchId(v); setTeamId(ALL); }}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("system_log.all_branches")}</SelectItem>
                  {(facets?.branches ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("system_log.all_teams")}</SelectItem>
                  {teamOptions.map((tm) => (
                    <SelectItem key={tm.id} value={String(tm.id)}>{tm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
              <ResetFiltersButton show={hasFilters} onClick={resetFilters} />
            </div>
          }
        />

        <p className="text-[11px] text-muted-foreground">{t("system_log.footnote")}</p>
      </div>

      <LogDetailDialog row={selected} onClose={() => setSelected(null)} />
    </Layout>
  );
}

/* ── 상세 다이얼로그 ──────────────────────────────────────────────────────── */

export function LogDetailDialog({ row, onClose }: { row: LogRow | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const fields = row ? changedFields(row) : [];
  const ipRegion = formatIpRegion(row?.ip_geo, i18n.language);

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{t("system_log.detail_title")}</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("system_log.col_time")} value={formatDateTime(row.logged_at)} />
              <Field label={t("system_log.col_source")} value={row.source === "audit" ? t("system_log.source_audit") : t("system_log.source_activity")} />
              <Field label={t("system_log.col_actor")} value={`${actorName(row)}${row.actor_email ? ` (${row.actor_email})` : ""}`} />
              <Field label={t("system_log.col_role")} value={row.actor_role ?? row.actor_type ?? "—"} />
              <Field label={t("system_log.col_resource")} value={`${row.resource_type ?? "—"}${row.resource_id != null ? ` #${row.resource_id}` : ""}`} />
              <Field label={t("system_log.col_org")} value={[row.branch_name, row.team_name].filter(Boolean).join(" · ") || "—"} />
              <Field
                label={t("system_log.col_ip")}
                value={
                  <>
                    <div>{row.ip_address ?? "—"}</div>
                    {ipRegion && (
                      <div className="text-muted-foreground" title={t("system_log.ip_region_note")}>
                        {t("system_log.ip_region_prefix")} {ipRegion}
                      </div>
                    )}
                  </>
                }
              />
              <Field label={t("system_log.col_action")} value={<ActionBadge action={row.action} />} />
            </div>

            {row.path && (
              <Field
                label={t("system_log.col_request")}
                value={`${row.method ?? ""} ${row.path}${row.status_code ? ` · ${row.status_code}` : ""}${row.duration_ms != null ? ` · ${row.duration_ms}ms` : ""}`}
              />
            )}

            {fields.length > 0 && (
              <div>
                <div className="mb-1 text-muted-foreground">{t("system_log.changed_fields")}</div>
                <div className="overflow-hidden rounded border">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-2 py-1 font-medium">{t("system_log.field")}</th>
                        <th className="px-2 py-1 font-medium">{t("system_log.before")}</th>
                        <th className="px-2 py-1 font-medium">{t("system_log.after")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => (
                        <tr key={f} className="border-t align-top">
                          <td className="px-2 py-1 font-medium">{f}</td>
                          <td className="px-2 py-1 text-muted-foreground">{stringify((row.old_value ?? {})[f])}</td>
                          <td className="px-2 py-1">{stringify((row.new_value ?? {})[f])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {row.metadata && Object.keys(row.metadata).length > 0 && (
              <div>
                <div className="mb-1 text-muted-foreground">{t("system_log.metadata")}</div>
                <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              </div>
            )}

            {row.notes && <Field label={t("system_log.notes")} value={row.notes} />}
            {row.user_agent && <Field label={t("system_log.user_agent")} value={row.user_agent} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="break-words">{value}</div>
    </div>
  );
}

function stringify(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
