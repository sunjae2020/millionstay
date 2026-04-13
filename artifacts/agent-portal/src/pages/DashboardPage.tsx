import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BookOpen, DollarSign, TrendingUp, Clock, ArrowRight } from "lucide-react";

interface DashboardData {
  account_name: string;
  stats: {
    total_bookings: number;
    active_bookings: number;
    total_rent_managed: number;
    estimated_commission_earned: number;
  };
  recent_bookings: Array<{
    id: number;
    booking_ref: string;
    booking_status: string;
    check_in_date: string;
    check_out_date: string;
    agreed_weekly_rate: string;
    total_rent: string;
  }>;
  commission: {
    commission_type: string;
    commission_rate: number | null;
    commission_amount: number | null;
  } | null;
}

const STATUS_CLS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-700",
  Active: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
  CheckedOut: "bg-purple-100 text-purple-700",
  Cancelled: "bg-red-100 text-red-700",
};

function StatCard({ label, value, sub, icon: Icon, iconCls }: { label: string; value: string | number; sub?: string; icon: React.ElementType; iconCls: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: DashboardData }>("/v1/agent/dashboard")
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back{user?.first_name ? `, ${user.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `Account: ${data.account_name}` : "Here's your performance summary"}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
            <StatCard label="Total Bookings" value={data.stats.total_bookings} icon={BookOpen} iconCls="bg-blue-50 text-blue-600" />
            <StatCard label="Active Bookings" value={data.stats.active_bookings} icon={Clock} iconCls="bg-yellow-50 text-yellow-600" />
            <StatCard label="Rent Managed" value={`$${Number(data.stats.total_rent_managed ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard
              label="Est. Commission"
              value={`$${Number(data.stats.estimated_commission_earned ?? 0).toLocaleString()}`}
              sub={data.commission ? (data.commission.commission_type === "Percentage" ? `${data.commission.commission_rate}% rate` : `$${data.commission.commission_amount} flat`) : undefined}
              icon={TrendingUp}
              iconCls="bg-green-50 text-green-600"
            />
          </div>

          <div className="bg-card border border-card-border rounded-xl">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="font-semibold text-foreground">Recent Bookings</h2>
              <Link href="/bookings">
                <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                  View all <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {data.recent_bookings.length === 0 && (
                <p className="text-sm text-muted-foreground p-6">No bookings assigned yet.</p>
              )}
              {data.recent_bookings.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Booking <span className="font-mono">{b.booking_ref ?? `#${b.id}`}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Check-in: {b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : "TBD"} · ${Number(b.agreed_weekly_rate ?? 0).toLocaleString()}/wk
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {b.booking_status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
