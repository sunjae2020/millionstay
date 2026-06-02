import { useState, useEffect } from "react";
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

interface FinanceSummary {
  total_revenue: number;
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

function fmt(n: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function shortMonth(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString("en", { month: "short" });
}

export default function FinanceTab() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [byProp, setByProp] = useState<PropertyRevenue[]>([]);
  const [taxRows, setTaxRows] = useState<TaxRow[]>([]);
  const { toast } = useToast();

  const { data: invoices, refetch } = useListInvoices({});

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/finance/summary").then(r => r.json()),
      apiFetch("/api/v1/finance/revenue/monthly?months=6").then(r => r.json()),
      apiFetch("/api/v1/finance/revenue/by-property").then(r => r.json()),
      apiFetch("/api/v1/finance/tax-summary").then(r => r.json()),
    ]).then(([s, m, p, t]) => {
      setSummary(s);
      setMonthly(Array.isArray(m) ? m : []);
      setByProp(Array.isArray(p) ? p : []);
      setTaxRows(Array.isArray(t) ? t : []);
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
    const matchSearch = !search || i.invoice_ref?.toLowerCase().includes(search.toLowerCase()) || (i as any).account_name?.toLowerCase()?.includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });
  const pageCount = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthLabel = new Date().toLocaleDateString("en", { month: "long", year: "numeric" });

  const donutData = summary ? [
    { name: "Paid", value: summary.paid_count },
    { name: "Outstanding", value: summary.sent_count },
    { name: "Draft", value: summary.draft_count },
    { name: "Overdue", value: summary.overdue_count },
  ].filter(d => d.value > 0) : [];

  const maxPropRevenue = byProp[0]?.revenue ?? 1;

  async function handleInvoiceAction(id: number, action: "send" | "pay" | "void") {
    try {
      const r = await apiFetch(`/api/v1/invoices/${id}/${action}`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: "Error", description: err.error ?? "Failed", variant: "destructive" });
      } else {
        toast({ title: "Done", description: `Invoice ${action === "send" ? "sent" : action === "pay" ? "marked as paid" : "voided"}.` });
        refetch();
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/finance/invoices/new">
          <Button size="sm" className="gap-1.5 bg-[#E8621A] hover:bg-[#d4541a] text-white">
            <Plus className="h-4 w-4" /> Create Invoice
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue (Settled)" value={summary ? fmt(summary.total_revenue) : "—"} icon={DollarSign} accent="green" sublabel="All paid invoices" />
        <KpiCard label="Sent Invoices" value={summary?.sent_count ?? "—"} icon={FileText} accent="amber" sublabel="Awaiting payment" />
        <KpiCard label="Paid This Month" value={summary?.paid_count ?? "—"} icon={CheckCircle} accent="brand" sublabel={currentMonthLabel} />
        <KpiCard label="Overdue Invoices" value={summary?.overdue_count ?? "—"} icon={Clock} accent={summary?.overdue_count ? "red" : "slate"} sublabel="Past due date" trend={summary?.overdue_count ? "Follow up" : undefined} trendType="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard className="lg:col-span-2" title="6-Month Revenue Trend" icon={TrendingUp}>
          {monthly.length === 0 || monthly.every(m => (m.revenue ?? 0) === 0) ? (
            <div className="h-48 flex flex-col items-center justify-center gap-1 text-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No settled revenue in this period</p>
              <p className="text-xs text-muted-foreground/70">Revenue appears here once invoices are marked paid</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tickFormatter={shortMonth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [fmt(v), "Revenue"]}
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
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#E8621A] inline-block" /> Current month</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#fcd9c4] inline-block" /> Historical</span>
          </div>
        </DashCard>

        <DashCard title="Payment Status">
          {donutData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No invoices</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={DONUT_COLORS[entry.name as keyof typeof DONUT_COLORS] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashCard>
      </div>

      <DashCard
        title="Invoice List"
        bodyClass="p-0"
        action={<Link href="/finance/invoices" className="text-xs text-[#E8621A] hover:underline">Full list →</Link>}
      >
        <div className="px-4 py-3 border-b flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search invoice ref or account…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "Draft", "Sent", "Paid", "Overdue", "Void"].map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s === "All" ? "All Statuses" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {["Invoice #", "Account", "Amount", "Due Date", "Status", "Actions"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No invoices found</td></tr>
              ) : paginated.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">{inv.invoice_ref}</td>
                  <td className="px-3 py-2">{(inv as any).account_name ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{fmt(inv.amount ?? 0)}</td>
                  <td className="px-3 py-2">{inv.due_date ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Pill className={STATUS_BADGE[inv.effective_status] ?? "bg-gray-100 text-gray-600"}>{inv.effective_status}</Pill>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {inv.status === "Draft" && (
                        <>
                          <button onClick={() => handleInvoiceAction(inv.id, "send")} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Send</button>
                          <Link href={`/finance/invoices/${inv.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Edit</Link>
                        </>
                      )}
                      {(inv.status === "Sent" || inv.effective_status === "Overdue") && (
                        <>
                          <button onClick={() => handleInvoiceAction(inv.id, "pay")} className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200">Mark Paid</button>
                          <Link href={`/finance/invoices/${inv.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">View</Link>
                        </>
                      )}
                      {inv.status === "Paid" && (
                        <Link href={`/finance/invoices/${inv.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Receipt</Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
            <span className="text-muted-foreground">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
              <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Next ›</Button>
            </div>
          </div>
        )}
      </DashCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Revenue by Property" icon={Building2}>
          {byProp.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No data yet</div>
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

        <DashCard title="Tax Summary (6-Month)">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {["Period", "Gross Revenue", "Tax (10%)", "Net Revenue"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {taxRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">No data</td></tr>
                ) : [...taxRows].reverse().map(row => (
                  <tr key={row.month} className="hover:bg-muted/30">
                    <td className="px-2 py-1.5 font-medium">{shortMonth(row.month)} {row.month.slice(0, 4)}</td>
                    <td className="px-2 py-1.5">{fmt(row.gross_revenue)}</td>
                    <td className="px-2 py-1.5 text-orange-600">{fmt(row.tax_amount)}</td>
                    <td className="px-2 py-1.5 text-green-700 font-medium">{fmt(row.net_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>
      </div>
    </div>
  );
}
