import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { DollarSign, TrendingUp, Briefcase, FileText } from "lucide-react";

interface EarningsData {
  total_earned: string;
  by_service: { name: string; count: number; total: string }[];
  by_booking: { booking_id: number; booking_ref: string; check_in_date: string | null; booking_status: string | null; services: string[]; total: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Confirmed: "bg-blue-100 text-blue-700",
  CheckedOut: "bg-gray-100 text-gray-600",
  Draft: "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-red-100 text-red-700",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"by_service" | "by_booking">("by_service");

  useEffect(() => {
    apiGet<{ success: boolean; data: EarningsData }>("/v1/service-host/earnings")
      .then((r) => { if (r.success) setData(r.data); })
      .catch(() => setError("Failed to load earnings"))
      .finally(() => setLoading(false));
  }, []);

  const totalEarned = parseFloat(data?.total_earned ?? "0");
  const maxServiceTotal = Math.max(...(data?.by_service.map((s) => parseFloat(s.total)) ?? [1]), 1);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
          <p className="text-sm text-muted-foreground mt-1">Your service earnings breakdown</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 opacity-80" />
            <span className="text-sm opacity-80">Total Earned</span>
          </div>
          {loading ? (
            <div className="h-10 w-40 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-4xl font-bold">
              ${totalEarned.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              <span className="text-sm font-normal opacity-70 ml-1">AUD</span>
            </p>
          )}
          <p className="text-xs opacity-70 mt-2">
            From {data?.by_booking.length ?? 0} booking{(data?.by_booking.length ?? 0) !== 1 ? "s" : ""} · {data?.by_service.reduce((s, x) => s + x.count, 0) ?? 0} service job{(data?.by_service.reduce((s, x) => s + x.count, 0) ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setTab("by_service")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "by_service" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            By Service Type
          </button>
          <button
            onClick={() => setTab("by_booking")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "by_booking" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            By Booking
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : tab === "by_service" ? (
          data?.by_service.length === 0 ? (
            <EmptyState icon={TrendingUp} message="No earnings data yet" />
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {data?.by_service.map((s) => {
                const pct = (parseFloat(s.total) / maxServiceTotal) * 100;
                return (
                  <div key={s.name} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.count} job{s.count !== 1 ? "s" : ""}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        ${parseFloat(s.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          data?.by_booking.length === 0 ? (
            <EmptyState icon={FileText} message="No booking earnings yet" />
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {data?.by_booking.map((b) => (
                <div key={b.booking_id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-foreground">{b.booking_ref}</span>
                        {b.booking_status && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                            {b.booking_status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Check-in: {formatDate(b.check_in_date)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Services: {b.services.slice(0, 3).join(", ")}{b.services.length > 3 ? ` +${b.services.length - 3} more` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        ${parseFloat(b.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">AUD</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 text-center">
      <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">Your earnings will appear here once services are completed</p>
    </div>
  );
}
