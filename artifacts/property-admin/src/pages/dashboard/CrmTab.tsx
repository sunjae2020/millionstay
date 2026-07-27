import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useListContacts, useListAccounts, useListLeads, useListTasks } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Users, Briefcase, TrendingUp, CheckSquare, Plus, UserPlus,
  Building2, BedDouble, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard, DashCard, Pill, ACCENT } from "@/components/dashboard/DashboardKit";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

const LEAD_PIPELINE = ["New", "Contacted", "Qualified", "Converted"] as const;
const PIPELINE_COLOR: Record<string, string> = {
  New: "#94a3b8", Contacted: "#3b82f6", Qualified: "#d97706", Converted: "#16a34a",
};

const LEAD_STATUS_BADGE: Record<string, string> = {
  New: "bg-slate-100 text-slate-600", Contacted: "bg-blue-100 text-blue-700",
  Qualified: "bg-amber-100 text-amber-800", Converted: "bg-green-100 text-green-700",
  ConvertedToBooking: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700", Nurturing: "bg-purple-100 text-purple-700",
};

const CONVERTED_STATUSES = ["Converted", "ConvertedToBooking"];
const isConverted = (s?: string | null) => !!s && CONVERTED_STATUSES.includes(s);

const SOURCE_COLORS: Record<string, string> = {
  Website: "#E8621A", Referral: "#16a34a", Agent: "#3b82f6", Social: "#7c3aed", Other: "#94a3b8",
};

const TASK_PRIORITY_DOT: Record<string, string> = {
  High: "bg-red-500", Medium: "bg-amber-500", Low: "bg-gray-400",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  Todo: "bg-blue-100 text-blue-700", InProgress: "bg-yellow-100 text-yellow-800",
  Done: "bg-green-100 text-green-700", Cancelled: "bg-gray-100 text-gray-500",
};

export default function CrmTab() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const { data: contacts } = useListContacts();
  const { data: accounts } = useListAccounts();
  const { data: leads } = useListLeads({});
  const { data: tasks } = useListTasks({});

  const today = new Date().toISOString().slice(0, 10);

  const guestAccounts = accounts?.filter(a => a.account_type === "Guest").length ?? 0;
  const ownerAccounts = accounts?.filter(a => a.account_type === "SpaceOwner" || a.account_type === "Landlord").length ?? 0;

  const activeLeads = leads?.filter(l => !isConverted(l.lead_status) && l.lead_status !== "Lost").length ?? 0;
  const convertedLeads = leads?.filter(l => isConverted(l.lead_status)).length ?? 0;
  const totalLeads = leads?.length ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const openTasks = tasks?.filter(t => t.task_status === "Todo" || t.task_status === "InProgress").length ?? 0;
  const overdueTasks = tasks?.filter(t => t.due_date && t.due_date < today && t.task_status !== "Done" && t.task_status !== "Cancelled").length ?? 0;

  // Pipeline counts (Converted stage includes ConvertedToBooking)
  const pipelineCounts = LEAD_PIPELINE.map(stage => ({
    stage,
    count: leads?.filter(l => stage === "Converted" ? isConverted(l.lead_status) : l.lead_status === stage).length ?? 0,
  }));
  const maxPipeline = Math.max(1, ...pipelineCounts.map(p => p.count));

  // Lead sources
  const sourceCounts = (leads ?? []).reduce((acc, l) => {
    const s = l.lead_source ?? "Other";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

  // Account type breakdown
  const accountTypeCounts = (accounts ?? []).reduce((acc, a) => {
    const tpe = a.account_type ?? "Other";
    acc[tpe] = (acc[tpe] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentLeads = [...(leads ?? [])]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 7);

  const openTaskList = [...(tasks ?? [])]
    .filter(t => t.task_status === "Todo" || t.task_status === "InProgress")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 8);

  function fmtBudget(l: any) {
    const cur = l.budget_currency ?? currency;
    if (l.budget_min && l.budget_max) return `${formatMoney(l.budget_min, cur, currencyPosition)}–${formatMoney(l.budget_max, cur, currencyPosition)}`;
    if (l.budget_max) return `≤ ${formatMoney(l.budget_max, cur, currencyPosition)}`;
    if (l.budget_min) return `≥ ${formatMoney(l.budget_min, cur, currencyPosition)}`;
    return "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Link href="/account/contacts/new">
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> {t("dash_crm.new_contact")}
          </Button>
        </Link>
        <Link href="/account/leads/new">
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-[#d4541a] text-white">
            <Plus className="h-4 w-4" /> {t("dash_crm.new_lead")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} accent="blue" label={t("dash_crm.total_contacts")} value={contacts?.length ?? "—"} sublabel={t("dash_crm.people_in_crm")} />
        <KpiCard icon={Briefcase} accent="purple" label={t("dash_crm.accounts")} value={accounts?.length ?? "—"} sublabel={t("dash_crm.guests_owners", { guests: guestAccounts, owners: ownerAccounts })} />
        <KpiCard icon={TrendingUp} accent="brand" label={t("dash_crm.active_leads")} value={activeLeads} sublabel={t("dash_crm.conversion_rate_pct", { rate: conversionRate })} progress={conversionRate} trend={convertedLeads > 0 ? t("dash_crm.count_won", { count: convertedLeads }) : undefined} trendType="up" />
        <KpiCard icon={CheckSquare} accent={overdueTasks > 0 ? "red" : "green"} label={t("dash_crm.open_tasks")} value={openTasks} sublabel={overdueTasks > 0 ? t("dash_crm.count_overdue", { count: overdueTasks }) : t("dash_crm.all_on_track")} trend={overdueTasks > 0 ? t("dash_crm.overdue") : undefined} trendType="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard className="lg:col-span-2" title={t("dash_crm.lead_pipeline")} icon={Filter}>
          {totalLeads === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">{t("dash_crm.no_leads_yet")}</div>
          ) : (
            <div className="space-y-4 py-1">
              {pipelineCounts.map(({ stage, count }) => (
                <div key={stage}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIPELINE_COLOR[stage] }} />
                      {t(`dash_crm.stage_${stage.toLowerCase()}`)}
                    </span>
                    <span className="text-muted-foreground">{t("dash_crm.count_leads", { count })}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(count / maxPipeline) * 100}%`, background: PIPELINE_COLOR[stage] }} />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 border-t text-xs">
                <span className="text-muted-foreground">{t("dash_crm.conversion_converted_total")}</span>
                <span className="font-bold" style={{ color: ACCENT.green.fg }}>{conversionRate}%</span>
              </div>
            </div>
          )}
        </DashCard>

        <DashCard title={t("dash_crm.lead_sources")}>
          {sourceData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{t("common.no_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  {sourceData.map((entry, i) => (
                    <Cell key={i} fill={SOURCE_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          className="lg:col-span-2"
          title={t("dash_crm.recent_leads")}
          icon={TrendingUp}
          bodyClass="p-0"
          action={<Link href="/account/leads" className="text-xs text-primary hover:underline">{t("dash_crm.view_all_arrow")}</Link>}
        >
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {[t("dash_crm.col_ref"), t("common.name"), t("dash_crm.col_source"), t("dash_crm.col_budget"), t("common.status")].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentLeads.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t("dash_crm.no_leads_yet")}</td></tr>
                ) : recentLeads.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-medium">
                      <Link href={`/account/leads/${l.id}`} className="hover:text-primary">{l.lead_ref}</Link>
                    </td>
                    <td className="px-3 py-2">{[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-2">{l.lead_source ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtBudget(l)}</td>
                    <td className="px-3 py-2">
                      <Pill className={LEAD_STATUS_BADGE[l.lead_status] ?? "bg-gray-100 text-gray-600"}>{l.lead_status ?? "—"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>

        <DashCard
          title={t("dash_crm.open_tasks")}
          icon={CheckSquare}
          bodyClass="p-0"
          action={<Link href="/account/tasks" className="text-xs text-primary hover:underline">{t("dash_crm.all_arrow")}</Link>}
        >
          <div className="divide-y max-h-[340px] overflow-auto">
            {openTaskList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">{t("dash_crm.no_open_tasks")}</p>
            ) : openTaskList.map(task => {
              const overdue = task.due_date && task.due_date < today;
              return (
                <Link key={task.id} href={`/account/tasks/${task.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${TASK_PRIORITY_DOT[task.priority ?? "Low"] ?? "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{task.subject ?? t("dash_crm.untitled_task")}</p>
                    <p className={`text-[10px] mt-0.5 ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      {task.due_date
                        ? (overdue
                            ? t("dash_crm.due_date_overdue", { date: task.due_date })
                            : t("dash_crm.due_date", { date: task.due_date }))
                        : t("dash_crm.no_due_date")} · {t(`dash_crm.priority_${(task.priority ?? "Low").toLowerCase()}`)}
                    </p>
                  </div>
                  <Pill className={TASK_STATUS_BADGE[task.task_status] ?? "bg-gray-100 text-gray-600"}>{task.task_status}</Pill>
                </Link>
              );
            })}
          </div>
        </DashCard>
      </div>

      {/* Account type breakdown */}
      <DashCard title={t("dash_crm.account_types")} icon={Briefcase}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { type: "Guest", icon: BedDouble, accent: ACCENT.brand },
            { type: "SpaceOwner", icon: Building2, accent: ACCENT.green },
            { type: "Landlord", icon: Building2, accent: ACCENT.blue },
            { type: "Agent", icon: Briefcase, accent: ACCENT.purple },
          ].map(({ type, icon: Icon, accent }) => (
            <div key={type} className="rounded-xl border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent.bg, color: accent.fg }}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{accountTypeCounts[type] ?? 0}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{t(`dash_crm.account_type_${type.toLowerCase()}`)}</div>
              </div>
            </div>
          ))}
        </div>
      </DashCard>
    </div>
  );
}
