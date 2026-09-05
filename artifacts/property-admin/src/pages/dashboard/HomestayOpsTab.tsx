import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiFetch";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Handshake, DollarSign, CalendarCheck, Clock, Users, GraduationCap, ClipboardList } from "lucide-react";
import { KpiCard, DashCard, ACCENT } from "@/components/dashboard/DashboardKit";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
interface StatusCount { status: string; count: number }
interface TopAgent { agent_account_id: number; name: string; total: number }
interface HomestayOpsSummary {
  placements_by_status: StatusCount[];
  student_requests_by_status: StatusCount[];
  revenue: { total_paid: number; month_paid: number; pending: number };
  active_placements: number;
  agent_commissions: { pending: number; approved: number; paid: number };
  top_agents: TopAgent[];
}

const BAR_COLORS = ["#E8621A", "#16a34a", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#14b8a6", "#ec4899", "#4f46e5", "#64748b"];


export default function HomestayOpsTab() {
  const { currency, currencyPosition } = useBrand();
  const fmt = (n: number) => formatMoney(n, currency, currencyPosition);
  const { t } = useTranslation();
  const [summary, setSummary] = useState<HomestayOpsSummary | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/homestay-ops/summary")
      .then(r => r.json())
      .then((s: HomestayOpsSummary) => setSummary(s))
      .catch(() => {});
  }, []);

  const placementsData = summary?.placements_by_status ?? [];
  const requestsData = summary?.student_requests_by_status ?? [];
  const commissions = summary?.agent_commissions;
  const topAgents = summary?.top_agents ?? [];
  const currentMonthLabel = new Date().toLocaleDateString("en", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label={t("dash_homestay.kpi_active_placements")}
          value={summary?.active_placements ?? "—"}
          icon={CalendarCheck}
          accent="brand"
          sublabel={t("dash_homestay.kpi_active_placements_sub")}
        />
        <KpiCard
          label={t("dash_homestay.kpi_total_paid")}
          value={summary ? fmt(summary.revenue.total_paid) : "—"}
          icon={DollarSign}
          accent="green"
          sublabel={t("dash_homestay.kpi_total_paid_sub")}
        />
        <KpiCard
          label={t("dash_homestay.kpi_paid_month")}
          value={summary ? fmt(summary.revenue.month_paid) : "—"}
          icon={Handshake}
          accent="blue"
          sublabel={currentMonthLabel}
        />
        <KpiCard
          label={t("dash_homestay.kpi_pending")}
          value={summary ? fmt(summary.revenue.pending) : "—"}
          icon={Clock}
          accent={summary?.revenue.pending ? "amber" : "slate"}
          sublabel={t("dash_homestay.kpi_pending_sub")}
        />
      </div>

      {/* Status charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title={t("dash_homestay.placements_by_status")} icon={CalendarCheck}>
          {placementsData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              {t("dash_homestay.no_data")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={placementsData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis hide allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, t("dash_homestay.count")]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {placementsData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashCard>

        <DashCard title={t("dash_homestay.requests_by_status")} icon={GraduationCap}>
          {requestsData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              {t("dash_homestay.no_data")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={requestsData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis hide allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, t("dash_homestay.count")]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {requestsData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashCard>
      </div>

      {/* Agent commissions */}
      <DashCard title={t("dash_homestay.agent_commissions")} icon={Users}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border p-3" style={{ background: ACCENT.amber.bg }}>
            <div className="text-[11px] font-medium text-muted-foreground">{t("dash_homestay.commission_pending")}</div>
            <div className="text-lg font-bold" style={{ color: ACCENT.amber.fg }}>{commissions ? fmt(commissions.pending) : "—"}</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: ACCENT.blue.bg }}>
            <div className="text-[11px] font-medium text-muted-foreground">{t("dash_homestay.commission_approved")}</div>
            <div className="text-lg font-bold" style={{ color: ACCENT.blue.fg }}>{commissions ? fmt(commissions.approved) : "—"}</div>
          </div>
          <div className="rounded-lg border p-3" style={{ background: ACCENT.green.bg }}>
            <div className="text-[11px] font-medium text-muted-foreground">{t("dash_homestay.commission_paid")}</div>
            <div className="text-lg font-bold" style={{ color: ACCENT.green.fg }}>{commissions ? fmt(commissions.paid) : "—"}</div>
          </div>
        </div>

        {topAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
            <ClipboardList className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("dash_homestay.no_commissions")}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <ExportableTable fileName="homestay-ops-tab" className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium">{t("dash_homestay.col_agent")}</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">{t("dash_homestay.col_total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topAgents.map(a => (
                  <tr key={a.agent_account_id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-right">{fmt(a.total)}</td>
                  </tr>
                ))}
              </tbody>
            </ExportableTable>
          </div>
        )}
      </DashCard>
    </div>
  );
}
