import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Building2, BookOpen, DollarSign, TrendingUp, ArrowRight } from "lucide-react";

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  approval_status: string;
}

interface DashboardData {
  account_name: string;
  properties: Property[];
  stats: {
    total_properties: number;
    total_spaces: number;
    active_bookings: number;
    monthly_revenue: number;
  };
  recent_bookings: Array<{
    id: number;
    booking_ref: string;
    booking_status: string;
    space_id: number;
    check_in_date: string;
    agreed_weekly_rate: string;
  }>;
}

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

const STATUS_CLS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-700",
  Active: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
  CheckedOut: "bg-purple-100 text-purple-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: DashboardData }>("/v1/owner/dashboard")
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
          {data ? `Account: ${data.account_name}` : "Your property portfolio overview"}
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
            <StatCard label="Properties" value={data.stats.total_properties} sub={`${data.stats.total_spaces} spaces`} icon={Building2} iconCls="bg-blue-50 text-blue-600" />
            <StatCard label="Active Bookings" value={data.stats.active_bookings} icon={BookOpen} iconCls="bg-green-50 text-green-600" />
            <StatCard label="Est. Monthly Revenue" value={`$${Number(data.stats.monthly_revenue ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard label="Total Properties" value={data.properties.length} icon={TrendingUp} iconCls="bg-yellow-50 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                {data.recent_bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No bookings yet.</p>
                ) : (
                  data.recent_bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground font-mono">{b.booking_ref ?? `#${b.id}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Check-in: {b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : "TBD"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">${Number(b.agreed_weekly_rate ?? 0).toLocaleString()}/wk</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {b.booking_status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl">
              <div className="flex items-center justify-between p-6 border-b border-card-border">
                <h2 className="font-semibold text-foreground">My Properties</h2>
                <Link href="/properties">
                  <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                    View all <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {data.properties.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No properties found.</p>
                ) : (
                  data.properties.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.city}, {p.state}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.approval_status === "Approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {p.approval_status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
