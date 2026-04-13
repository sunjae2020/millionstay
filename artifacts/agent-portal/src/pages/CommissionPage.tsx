import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { DollarSign, TrendingUp, Clock, CheckCircle } from "lucide-react";

interface CommissionApiData {
  account_name: string;
  commission: {
    id: number;
    commission_type: string;
    commission_rate: number | null;
    commission_amount: number | null;
  } | null;
  total_earned: number;
  paid_count: number;
  pending_count: number;
  breakdown: Array<{
    booking_ref: string;
    booking_status: string;
    check_in_date: string;
    check_out_date: string;
    rent_amount: number;
    commission_earned: number;
  }>;
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

export default function CommissionPage() {
  const [data, setData] = useState<CommissionApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: CommissionApiData }>("/v1/agent/commission")
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Commission</h1>
        <p className="text-muted-foreground text-sm mt-1">Your earnings breakdown across all managed bookings</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {data && (
        <>
          {data.commission && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <span className="text-sm font-medium text-foreground">Your commission rate: </span>
                <span className="text-sm text-primary font-semibold">
                  {data.commission.commission_type === "Percentage"
                    ? `${data.commission.commission_rate}% of total rent`
                    : `$${data.commission.commission_amount} per booking`}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
            <StatCard label="Total Earned" value={`$${Number(data.total_earned ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard label="All Bookings" value={String(data.paid_count + data.pending_count)} icon={TrendingUp} iconCls="bg-blue-50 text-blue-600" />
            <StatCard label="Paid Bookings" value={String(data.paid_count)} icon={CheckCircle} iconCls="bg-green-50 text-green-600" />
            <StatCard label="Pending" value={String(data.pending_count)} icon={Clock} iconCls="bg-yellow-50 text-yellow-600" />
          </div>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Booking Breakdown</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Booking Ref</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check-in</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check-out</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Commission</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {!loading && data.breakdown.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No commission data yet</td></tr>
                )}
                {data.breakdown.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.booking_ref}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.check_in_date ? new Date(row.check_in_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.check_out_date ? new Date(row.check_out_date).toLocaleDateString() : "Ongoing"}
                    </td>
                    <td className="px-4 py-3 text-foreground">${Number(row.rent_amount ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">${Number(row.commission_earned ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${["Active", "CheckedOut"].includes(row.booking_status) ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {row.booking_status}
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
