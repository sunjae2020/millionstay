import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { DollarSign, TrendingUp, Clock } from "lucide-react";

interface Invoice {
  id: number;
  booking_id: number;
  invoice_ref: string;
  due_date: string;
  amount_due: string;
  amount_paid: string;
  status: string;
  currency: string;
  space_name: string;
  property_name: string;
}

interface RevenueData {
  properties: Array<{ id: number; name: string }>;
  total_revenue: number;
  pending_revenue: number;
  invoices: Invoice[];
}

function StatCard({ label, value, icon: Icon, iconCls }: { label: string; value: string; icon: React.ElementType; iconCls: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

const INV_STATUS_CLS: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Overdue: "bg-red-100 text-red-700",
  Draft: "bg-gray-100 text-gray-600",
  Void: "bg-gray-100 text-gray-600",
};

export default function RevenuePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: RevenueData }>("/v1/owner/revenue")
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("revenue.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("revenue.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            <StatCard label={t("revenue.total_collected")} value={`$${Number(data.total_revenue ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard label={t("revenue.pending")} value={`$${Number(data.pending_revenue ?? 0).toLocaleString()}`} icon={Clock} iconCls="bg-yellow-50 text-yellow-600" />
            <StatCard label={t("revenue.total_invoices")} value={String(data.invoices.length)} icon={TrendingUp} iconCls="bg-blue-50 text-blue-600" />
          </div>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{t("revenue.invoice_history")}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_invoice")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_property_space")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_due")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_amount_due")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_amount_paid")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                )}
                {!loading && data.invoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("revenue.no_invoices")}</td></tr>
                )}
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.invoice_ref ?? `#${inv.id}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{inv.property_name}</div>
                      <div className="text-xs text-muted-foreground">{inv.space_name}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      ${Number(inv.amount_due ?? 0).toLocaleString()} {inv.currency && <span className="text-muted-foreground text-xs">{inv.currency}</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-600">
                      ${Number(inv.amount_paid ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${INV_STATUS_CLS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(`status.${inv.status}`, inv.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && !data && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      )}
    </Layout>
  );
}
