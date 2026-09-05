import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter, ALL } from "@/components/list-filters";
import { apiFetch } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { BarChart3, Building2, Clock, ScrollText, Users2, User, RefreshCw } from "lucide-react";
import { ActionBadge, actorName, changedFields, type LogRow } from "./SystemLog";

/**
 * 활동 분석 — 시스템 로그를 사람·팀·지점 기준으로 굴린 화면.
 *
 * "근무시간"은 근태 기록이 아니라 **첫 활동 ~ 마지막 활동의 간격**이다. 전화·현장
 * 업무처럼 시스템에 흔적이 남지 않는 일은 잡히지 않으므로, 화면 아래에도 그렇게
 * 적어 둔다. 평가 지표로 쓰라고 만든 화면이 아니다.
 */

type Tab = "user" | "team" | "branch";

interface WorkHoursRow {
  date: string;
  actor_id: number;
  actor_email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  branch_name: string | null;
  team_name: string | null;
  first_at: string;
  last_at: string;
  hours: string | number;
  action_count: number;
}

interface GroupRow {
  date: string;
  team_id?: number | null;
  branch_id?: number | null;
  team_name?: string;
  branch_name?: string;
  active_users: number;
  action_count: number;
  first_at: string;
  last_at: string;
}

interface Facets {
  actors: Array<{ id: number; email: string; first_name: string; last_name: string; role: string }>;
  branches: Array<{ id: number; name: string }>;
  teams: Array<{ id: number; name: string; branch_id: number }>;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function fmtClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtHours(v: string | number | null | undefined, t: (k: string, o?: any) => string): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n <= 0) return t("activity_analytics.hours_short", { h: 0, m: 0 });
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return t("activity_analytics.hours_short", { h, m });
}

export default function ActivityAnalyticsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("user");
  const [from, setFrom] = useState(daysAgoISO(13));
  const [to, setTo] = useState(todayISO());
  const [branchId, setBranchId] = useState(ALL);
  const [teamId, setTeamId] = useState(ALL);
  const [actorId, setActorId] = useState(ALL);
  const [drill, setDrill] = useState<{ date: string; label: string; actorId?: number; teamId?: number | null; branchId?: number | null } | null>(null);

  const { data: facets } = useQuery<Facets>({
    queryKey: ["system-log-facets"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/system-logs/facets");
      if (!res.ok) throw new Error("facets");
      return (await res.json()).data as Facets;
    },
  });

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (branchId !== ALL) p.set("branch_id", branchId);
    if (teamId !== ALL) p.set("team_id", teamId);
    if (actorId !== ALL) p.set("actor_id", actorId);
    return p.toString();
  }, [from, to, branchId, teamId, actorId]);

  const userQ = useQuery<WorkHoursRow[]>({
    queryKey: ["activity-work-hours", qs],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/system-logs/work-hours?${qs}`);
      if (!res.ok) throw new Error("work-hours");
      return (await res.json()).data as WorkHoursRow[];
    },
    enabled: tab === "user",
  });

  const teamQ = useQuery<GroupRow[]>({
    queryKey: ["activity-by-team", qs],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/system-logs/by-team?${qs}`);
      if (!res.ok) throw new Error("by-team");
      return (await res.json()).data as GroupRow[];
    },
    enabled: tab === "team",
  });

  const branchQ = useQuery<GroupRow[]>({
    queryKey: ["activity-by-branch", qs],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/system-logs/by-branch?${qs}`);
      if (!res.ok) throw new Error("by-branch");
      return (await res.json()).data as GroupRow[];
    },
    enabled: tab === "branch",
  });

  const teamOptions = useMemo(() => {
    const all = facets?.teams ?? [];
    return branchId === ALL ? all : all.filter((tm) => String(tm.branch_id) === branchId);
  }, [facets, branchId]);

  // 기간 전체를 사람 단위로 합산 — 카드에 얹고, 막대그래프로도 쓴다.
  const perUser = useMemo(() => {
    const map = new Map<number, {
      actor_id: number; name: string; email: string | null; role: string | null;
      hours: number; days: number; actions: number;
    }>();
    for (const r of userQ.data ?? []) {
      const key = r.actor_id;
      const entry = map.get(key) ?? {
        actor_id: key,
        name: [r.last_name, r.first_name].filter(Boolean).join("") || r.actor_email || `#${key}`,
        email: r.actor_email,
        role: r.role,
        hours: 0, days: 0, actions: 0,
      };
      entry.hours += Number(r.hours ?? 0);
      entry.days += 1;
      entry.actions += Number(r.action_count ?? 0);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.actions - a.actions);
  }, [userQ.data]);

  const refetchCurrent = () => {
    if (tab === "user") void userQ.refetch();
    if (tab === "team") void teamQ.refetch();
    if (tab === "branch") void branchQ.refetch();
  };

  const TABS: Array<{ key: Tab; label: string; icon: typeof User }> = [
    { key: "user", label: t("activity_analytics.tab_user"), icon: User },
    { key: "team", label: t("activity_analytics.tab_team"), icon: Users2 },
    { key: "branch", label: t("activity_analytics.tab_branch"), icon: Building2 },
  ];

  return (
    <Layout>
      <PageHeader
        title={
          <>
            <BarChart3 className="h-4 w-4 text-primary" />
            {t("activity_analytics.title")}
          </>
        }
        subtitle={t("activity_analytics.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetchCurrent}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {t("common.refresh")}
            </Button>
            <Link href="/settings/system-log">
              <Button size="sm" variant="outline">
                <ScrollText className="mr-1 h-4 w-4" />
                {t("activity_analytics.open_log")}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <Select value={branchId} onValueChange={(v) => { setBranchId(v); setTeamId(ALL); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity_analytics.all_branches")}</SelectItem>
              {(facets?.branches ?? []).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamId} onValueChange={setTeamId} disabled={tab === "branch"}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity_analytics.all_teams")}</SelectItem>
              {teamOptions.map((tm) => (
                <SelectItem key={tm.id} value={String(tm.id)}>{tm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actorId} onValueChange={setActorId} disabled={tab !== "user"}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity_analytics.all_users")}</SelectItem>
              {(facets?.actors ?? []).map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {[u.last_name, u.first_name].filter(Boolean).join("") || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "user" && (
          <div className="space-y-3">
            {userQ.isLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : perUser.length === 0 ? (
              <EmptyBox text={t("activity_analytics.empty")} />
            ) : (
              <>
                <div className="rounded-lg border bg-card p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {t("activity_analytics.actions_per_user")}
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(140, perUser.length * 28)}>
                    <BarChart data={perUser} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="actions" name={t("activity_analytics.col_actions")} fill="var(--color-primary)" radius={[0, 3, 3, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {perUser.map((u) => (
                    <div key={u.actor_id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{u.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {u.email}{u.role ? ` · ${u.role}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                            <Clock className="h-3.5 w-3.5" />
                            {fmtHours(u.hours, t)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {t("activity_analytics.days_actions", { days: u.days, actions: u.actions })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <Th>{t("activity_analytics.col_date")}</Th>
                    <Th>{t("activity_analytics.col_user")}</Th>
                    <Th>{t("activity_analytics.col_org")}</Th>
                    <Th>{t("activity_analytics.col_first")}</Th>
                    <Th>{t("activity_analytics.col_last")}</Th>
                    <Th>{t("activity_analytics.col_span")}</Th>
                    <Th>{t("activity_analytics.col_actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {userQ.isLoading ? (
                    <SkeletonRows cols={7} />
                  ) : (userQ.data ?? []).length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{t("activity_analytics.empty")}</td></tr>
                  ) : (userQ.data ?? []).map((r) => (
                    <tr
                      key={`${r.actor_id}-${r.date}`}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => setDrill({
                        date: r.date,
                        actorId: r.actor_id,
                        label: `${[r.last_name, r.first_name].filter(Boolean).join("") || r.actor_email} · ${formatDate(r.date)}`,
                      })}
                    >
                      <Td>{formatDate(r.date)}</Td>
                      <Td>
                        <div className="font-medium">{[r.last_name, r.first_name].filter(Boolean).join("") || r.actor_email}</div>
                        <div className="text-[11px] text-muted-foreground">{r.actor_email}</div>
                      </Td>
                      <Td className="text-muted-foreground">{[r.branch_name, r.team_name].filter(Boolean).join(" · ") || "—"}</Td>
                      <Td className="font-mono">{fmtClock(r.first_at)}</Td>
                      <Td className="font-mono">{fmtClock(r.last_at)}</Td>
                      <Td className="font-medium text-primary">{fmtHours(r.hours, t)}</Td>
                      <Td>{r.action_count}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(tab === "team" || tab === "branch") && (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <Th>{t("activity_analytics.col_date")}</Th>
                  <Th>{tab === "team" ? t("activity_analytics.col_team") : t("activity_analytics.col_branch")}</Th>
                  <Th>{t("activity_analytics.col_active_users")}</Th>
                  <Th>{t("activity_analytics.col_first")}</Th>
                  <Th>{t("activity_analytics.col_last")}</Th>
                  <Th>{t("activity_analytics.col_actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {(tab === "team" ? teamQ.isLoading : branchQ.isLoading) ? (
                  <SkeletonRows cols={6} />
                ) : ((tab === "team" ? teamQ.data : branchQ.data) ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t("activity_analytics.empty")}</td></tr>
                ) : ((tab === "team" ? teamQ.data : branchQ.data) ?? []).map((r, i) => {
                  const name = tab === "team" ? r.team_name : r.branch_name;
                  return (
                    <tr
                      key={`${tab}-${r.team_id ?? r.branch_id ?? "none"}-${r.date}-${i}`}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => setDrill({
                        date: r.date,
                        label: `${name} · ${formatDate(r.date)}`,
                        ...(tab === "team" ? { teamId: r.team_id ?? null } : { branchId: r.branch_id ?? null }),
                      })}
                    >
                      <Td>{formatDate(r.date)}</Td>
                      <Td className="font-medium">
                        {name}
                        {tab === "team" && r.branch_name && (
                          <span className="ml-1 text-[11px] text-muted-foreground">{r.branch_name}</span>
                        )}
                      </Td>
                      <Td>{r.active_users}</Td>
                      <Td className="font-mono">{fmtClock(r.first_at)}</Td>
                      <Td className="font-mono">{fmtClock(r.last_at)}</Td>
                      <Td>{r.action_count}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{t("activity_analytics.footnote")}</p>
      </div>

      <DrillDownDialog scope={drill} onClose={() => setDrill(null)} />
    </Layout>
  );
}

/* ── 하루치 드릴다운 ──────────────────────────────────────────────────────── */

function DrillDownDialog({
  scope,
  onClose,
}: {
  scope: { date: string; label: string; actorId?: number; teamId?: number | null; branchId?: number | null } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const qs = useMemo(() => {
    if (!scope) return "";
    const p = new URLSearchParams();
    p.set("from", scope.date);
    p.set("to", scope.date);
    p.set("limit", "300");
    if (scope.actorId) p.set("actor_id", String(scope.actorId));
    if (scope.teamId) p.set("team_id", String(scope.teamId));
    if (scope.branchId) p.set("branch_id", String(scope.branchId));
    return p.toString();
  }, [scope]);

  const { data, isLoading } = useQuery<LogRow[]>({
    queryKey: ["activity-drill", qs],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/system-logs?${qs}`);
      if (!res.ok) throw new Error("drill");
      const body = await res.json();
      return (Array.isArray(body) ? body : (body.data ?? [])) as LogRow[];
    },
    enabled: !!scope,
  });

  const rows = data ?? [];
  const byAction = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.action, (m.get(r.action) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <Dialog open={!!scope} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("activity_analytics.drill_title")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{scope?.label}</span>
          </DialogTitle>
        </DialogHeader>

        {byAction.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {byAction.map(([a, c]) => (
              <span key={a} className="inline-flex items-center gap-1 text-[11px]">
                <ActionBadge action={a} />
                <span className="text-muted-foreground">×{c}</span>
              </span>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {t("activity_analytics.total_count", { count: rows.length })}
            </span>
          </div>
        )}

        <div className="overflow-auto">
          {isLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("activity_analytics.empty")}</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/50 text-left">
                <tr>
                  <Th>{t("activity_analytics.col_time")}</Th>
                  <Th>{t("activity_analytics.col_user")}</Th>
                  <Th>{t("system_log.col_action")}</Th>
                  <Th>{t("system_log.col_resource")}</Th>
                  <Th>{t("system_log.col_detail")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.source}-${r.id}`} className="border-t align-top">
                    <Td className="whitespace-nowrap font-mono">{fmtClock(r.logged_at)}</Td>
                    <Td>{actorName(r)}</Td>
                    <Td><ActionBadge action={r.action} /></Td>
                    <Td>
                      {r.resource_type ?? "—"}
                      {r.resource_id != null && <span className="text-muted-foreground"> #{r.resource_id}</span>}
                    </Td>
                    <Td className="max-w-md text-muted-foreground">
                      {r.source === "audit"
                        ? changedFields(r).slice(0, 5).join(", ") || "—"
                        : `${r.method ?? ""} ${r.path ?? ""}`}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── 작은 조각들 ─────────────────────────────────────────────────────────── */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-t">
          <td colSpan={cols} className="p-2"><Skeleton className="h-5 w-full" /></td>
        </tr>
      ))}
    </>
  );
}
function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
