import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { useListInvoices } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { DollarSign, FileText, CheckCircle, Clock, Plus, Search, TrendingUp, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { KpiCard, DashCard, Pill } from "@/components/dashboard/DashboardKit";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { matchesQuery } from "@/lib/search";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
interface FinanceSummary {
  /** Gross — everything received, including money owed onward to owners/partners. */
  total_revenue: number;
  total_gross_receipts?: number;
  monthly_gross_receipts?: number;
  /** Net (실 매출) — the retained legs, i.e. what is actually ours. */
  total_net_revenue?: number;
  monthly_net_revenue?: number;
  monthly_revenue: number;
  sent_count: number;
  paid_count: number;
  draft_count: number;
  overdue_count: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoice_count: number;
}

interface PropertyRevenue {
  property_id: number;
  property_name: string;
  revenue: number;
}

interface TaxRow {
  month: string;
  gross_revenue: number;
  tax_rate: number;
  tax_amount: number;
  net_revenue: number;
}

const DONUT_COLORS = {
  Paid: "#16a34a",
  Outstanding: "#f59e0b",
  Draft: "#94a3b8",
  Overdue: "#ef4444",
};

const STATUS_BADGE: Record<string, string> = {
  Draft:   "bg-gray-100 text-gray-600",
  Sent:    "bg-yellow-100 text-yellow-800",
  Paid:    "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-800",
  Void:    "bg-gray-100 text-gray-500",
};

function shortMonth(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString("en", { month: "short" });
}

export default function FinanceTab() {
  const { t, i18n } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const fmt = (n: number) => formatMoney(n, currency, currencyPosition);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [byProp, setByProp] = useState<PropertyRevenue[]>([]);
  const [taxRows, setTaxRows] = useState<TaxRow[]>([]);
  const [arrears, setArrears] = useState<{ total_amount: number; total_invoices: number; contracts: number; data: any[] } | null>(null);
  const { toast } = useToast();

  const { data: invoices, refetch } = useListInvoices({});

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/finance/summary").then(r => r.json()),
      apiFetch("/api/v1/finance/revenue/monthly?months=6").then(r => r.json()),
      apiFetch("/api/v1/finance/revenue/by-property").then(r => r.json()),
      apiFetch("/api/v1/finance/tax-summary").then(r => r.json()),
      apiFetch("/api/v1/finance/rent-arrears").then(r => r.json()).catch(() => null),
    ]).then(([s, m, p, t, a]) => {
      setSummary(s);
      setMonthly(Array.isArray(m) ? m : []);
      setByProp(Array.isArray(p) ? p : []);
      setTaxRows(Array.isArray(t) ? t : []);
      setArrears(a && Array.isArray(a.data) ? a : null);
    }).catch(() => {});
  }, []);

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const today = new Date().toISOString().slice(0, 10);
  const enrichedInvoices = (invoices ?? []).map(inv => ({
    ...inv,
    effective_status: inv.status === "Sent" && inv.due_date && inv.due_date < today ? "Overdue" : inv.status,
  }));

  const filtered = enrichedInvoices.filter(i => {
    const matchStatus = statusFilter === "All" || i.effective_status === statusFilter;
    const matchSearch = matchesQuery(search, i.invoice_ref, (i as any).account_name, i.amount, (i as any).description);
    return matchStatus && matchSearch;
  });
  const pageCount = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthLabel = new Date().toLocaleDateString(i18n.language, { month: "long", year: "numeric" });

  const donutData = summary ? [
    { name: t("dash_finance.status_paid"), value: summary.paid_count },
    { name: t("dash_finance.status_sent"), value: summary.sent_count },
    { name: t("dash_finance.status_draft"), value: summary.draft_count },
    { name: t("dash_finance.status_overdue"), value: summary.overdue_count },
  ].filter(d => d.value > 0) : [];

  const maxPropRevenue = byProp[0]?.revenue ?? 1;

  async function handleInvoiceAction(id: number, action: "send" | "pay" | "void") {
    try {
      const r = await apiFetch(`/api/v1/invoices/${id}/${action}`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: t("dash_finance.toast_error_title"), description: err.error ?? t("dash_finance.toast_failed"), variant: "destructive" });
      } else {
        const actionMsg = action === "send" ? t("dash_finance.action_sent") : action === "pay" ? t("dash_finance.action_marked_paid") : t("dash_finance.action_voided");
        toast({ title: t("dash_finance.toast_done_title"), description: t("dash_finance.invoice_action_result", { action: actionMsg }) });
        refetch();
      }
    } catch {
      toast({ title: t("dash_finance.toast_error_title"), description: t("dash_finance.toast_network_error"), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/finance/invoices/new">
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-[#d4541a] text-white">
            <Plus className="h-4 w-4" /> {t("dash_finance.create_invoice")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* What we actually earned, not what passed through us: gross receipts
            include the owner's rent and partner costs, most of which is not ours. */}
        <KpiCard
          label={t("dash_finance.net_revenue")}
          value={summary ? fmt(summary.total_net_revenue ?? 0) : "—"}
          icon={DollarSign}
          accent="green"
          sublabel={summary ? t("dash_finance.gross_receipts_sub", { amount: fmt(summary.total_gross_receipts ?? summary.total_revenue) }) : t("dash_finance.all_paid_invoices")}
        />
        <KpiCard label={t("dash_finance.sent_invoices")} value={summary?.sent_count ?? "—"} icon={FileText} accent="amber" sublabel={t("dash_finance.awaiting_payment")} />
        <KpiCard label={t("dash_finance.paid_this_month")} value={summary?.paid_count ?? "—"} icon={CheckCircle} accent="brand" sublabel={currentMonthLabel} />
        <KpiCard label={t("dash_finance.overdue_invoices")} value={summary?.overdue_count ?? "—"} icon={Clock} accent={summary?.overdue_count ? "red" : "slate"} sublabel={t("dash_finance.past_due_date")} trend={summary?.overdue_count ? t("dash_finance.follow_up") : undefined} trendType="down" />
      </div>

      {arrears && arrears.data.length > 0 && (
        <DashCard title={`${t("dash_finance.rent_arrears")} · ${arrears.contracts}${t("dash_finance.arrears_contracts_suffix")}`} icon={Clock}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
            <span className="text-xl font-bold text-red-600">{fmt(arrears.total_amount)}</span>
            <span className="text-xs text-muted-foreground">{t("dash_finance.arrears_invoices", { count: arrears.total_invoices })}</span>
          </div>
          <div className="overflow-x-auto">
            <ExportableTable fileName="dashboard-rent-arrears" className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">{t("dash_finance.arrears_tenant")}</th>
                  <th className="text-left py-2 pr-3 font-medium">{t("dash_finance.arrears_unit")}</th>
                  <th className="text-right py-2 pr-3 font-medium">{t("dash_finance.arrears_months")}</th>
                  <th className="text-right py-2 pr-3 font-medium">{t("dash_finance.arrears_amount")}</th>
                  <th className="text-left py-2 font-medium">{t("dash_finance.arrears_oldest")}</th>
                </tr>
              </thead>
              <tbody>
                {arrears.data.slice(0, 10).map((row: any) => (
                  <tr key={row.contract_id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/contracts/${row.contract_id}`} className="text-primary hover:underline">
                        {row.tenant_name ?? row.contract_ref}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.unit_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-medium">{row.months}</td>
                    <td className="py-2 pr-3 text-right font-mono text-red-600">{fmt(row.total_amount)}</td>
                    <td className="py-2 text-muted-foreground">{row.oldest_due_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </ExportableTable>
          </div>
          {arrears.data.length > 10 && (
            <p className="text-xs text-muted-foreground mt-2">{t("dash_finance.arrears_more", { count: arrears.data.length - 10 })}</p>
          )}
        </DashCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard className="lg:col-span-2" title={t("dash_finance.revenue_trend_6mo")} icon={TrendingUp}>
          {monthly.length === 0 || monthly.every(m => (m.revenue ?? 0) === 0) ? (
            <div className="h-48 flex flex-col items-center justify-center gap-1 text-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("dash_finance.no_settled_revenue")}</p>
              <p className="text-xs text-muted-foreground/70">{t("dash_finance.revenue_appears_hint")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tickFormatter={shortMonth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [fmt(v), t("dash_finance.revenue")]}
                  labelFormatter={(l: string) => shortMonth(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {monthly.map((entry, i) => (
                    <Cell key={i} fill={entry.month === currentMonth ? "#E8621A" : "#fcd9c4"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> {t("dash_finance.current_month")}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#fcd9c4] inline-block" /> {t("dash_finance.historical")}</span>
          </div>
        </DashCard>

        <DashCard title={t("dash_finance.payment_status")}>
          {donutData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{t("dash_finance.no_invoices")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={DONUT_COLORS[entry.name as keyof typeof DONUT_COLORS] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => t(`dash_finance.donut_${value.toLowerCase()}`)} />
                <Tooltip formatter={(v: number, name: string) => [v, t(`dash_finance.donut_${name.toLowerCase()}`)]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashCard>
      </div>

      <DashCard
        title={t("dash_finance.invoice_list")}
        bodyClass="p-0"
        action={<Link href="/finance/invoices" className="text-xs text-primary hover:underline">{t("dash_finance.full_list")}</Link>}
      >
        <div className="px-4 py-3 border-b flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("dash_finance.search_placeholder")} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "Draft", "Sent", "Paid", "Overdue", "Void"].map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s === "All" ? t("dash_finance.all_statuses") : t(`dash_finance.status_${s.toLowerCase()}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-auto">
          <ExportableTable fileName="dashboard-finance-transactions" className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {[t("dash_finance.col_invoice_no"), t("dash_finance.col_account"), t("common.amount"), t("dash_finance.col_due_date"), t("common.status"), t("common.actions")].map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{t("dash_finance.no_invoices_found")}</td></tr>
              ) : paginated.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">{inv.invoice_ref}</td>
                  <td className="px-3 py-2">{(inv as any).account_name ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{fmt(inv.amount ?? 0)}</td>
                  <td className="px-3 py-2">{formatDate(inv.due_date)}</td>
                  <td className="px-3 py-2">
                    <Pill className={STATUS_BADGE[inv.effective_status] ?? "bg-gray-100 text-gray-600"}>{t(`dash_finance.status_${String(inv.effective_status).toLowerCase()}`)}</Pill>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {inv.status === "Draft" && (
                        <>
                          <button onClick={() => handleInvoiceAction(inv.id, "send")} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">{t("common.send")}</button>
                          <Link href={`/finance/invoices/${inv.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">{t("common.edit")}</Link>
                        </>
                      )}
                      {(inv.status === "Sent" || inv.effective_status === "Overdue") && (
                        <>
                          <button onClick={() => handleInvoiceAction(inv.id, "pay")} className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200">{t("dash_finance.mark_paid")}</button>
                          <Link href={`/finance/invoices/${inv.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">{t("common.view")}</Link>
                        </>
                      )}
                      {inv.status === "Paid" && (
                        <Link href={`/finance/invoices/${inv.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">{t("dash_finance.receipt")}</Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ExportableTable>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
            <span className="text-muted-foreground">{t("dash_finance.showing_range", { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, filtered.length), total: filtered.length })}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ {t("common.prev")}</Button>
              <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>{t("common.next")} ›</Button>
            </div>
          </div>
        )}
      </DashCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title={t("dash_finance.revenue_by_property")} icon={Building2}>
          {byProp.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">{t("dash_finance.no_data_yet")}</div>
          ) : (
            <div className="space-y-3">
              {byProp.slice(0, 8).map((p, i) => (
                <div key={p.property_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="truncate font-medium max-w-[180px]">{p.property_name}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{fmt(p.revenue)} · {Math.round(p.revenue / maxPropRevenue * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.revenue / maxPropRevenue) * 100}%`,
                        backgroundColor: ["#E8621A", "#16a34a", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"][i % 8],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        <DashCard title={t("dash_finance.tax_summary_6mo")}>
          <div className="overflow-auto">
            <ExportableTable fileName="dashboard-tax-summary" className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {[t("dash_finance.col_period"), t("dash_finance.col_gross_revenue"), t("dash_finance.col_tax_10"), t("dash_finance.col_net_revenue")].map((h, hi) => (
                    <th key={hi} className="px-2 py-1.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {taxRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">{t("common.no_data")}</td></tr>
                ) : [...taxRows].reverse().map(row => (
                  <tr key={row.month} className="hover:bg-muted/30">
                    <td className="px-2 py-1.5 font-medium">{shortMonth(row.month)} {row.month.slice(0, 4)}</td>
                    <td className="px-2 py-1.5">{fmt(row.gross_revenue)}</td>
                    <td className="px-2 py-1.5 text-orange-600">{fmt(row.tax_amount)}</td>
                    <td className="px-2 py-1.5 text-green-700 font-medium">{fmt(row.net_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </ExportableTable>
          </div>
        </DashCard>
      </div>
    </div>
  );
}
