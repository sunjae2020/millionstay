import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/money";
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

export default function EarningsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"by_service" | "by_booking">("by_service");

  useEffect(() => {
    apiGet<{ success: boolean; data: EarningsData }>("/v1/service-host/earnings")
      .then((r) => { if (r.success) setData(r.data); })
      .catch(() => setError(t("earnings.load_failed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalEarned = parseFloat(data?.total_earned ?? "0");
  const maxServiceTotal = Math.max(...(data?.by_service.map((s) => parseFloat(s.total)) ?? [1]), 1);
  const totalServices = data?.by_service.reduce((s, x) => s + x.count, 0) ?? 0;
  const totalBookings = data?.by_booking.length ?? 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("earnings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("earnings.subtitle")}</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 opacity-80" />
            <span className="text-sm opacity-80">{t("earnings.total_earned")}</span>
          </div>
          {loading ? (
            <div className="h-10 w-40 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-4xl font-bold">
              {formatMoney(totalEarned)}
            </p>
          )}
          <p className="text-xs opacity-70 mt-2">
            {t("earnings.from_bookings", { count: totalBookings, bookings: totalBookings, services: totalServices })}
          </p>
        </div>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setTab("by_service")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "by_service" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("earnings.by_service")}
          </button>
          <button
            onClick={() => setTab("by_booking")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "by_booking" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("earnings.by_booking")}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : tab === "by_service" ? (
          data?.by_service.length === 0 ? (
            <EmptyState icon={TrendingUp} message={t("earnings.no_data")} help={t("earnings.earnings_help")} />
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
                        <span className="text-xs text-muted-foreground">{t("earnings.jobs_count", { count: s.count })}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        {formatMoney(s.total)}
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
            <EmptyState icon={FileText} message={t("earnings.no_booking_earnings")} help={t("earnings.earnings_help")} />
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
                            {t(`status.${b.booking_status}`, b.booking_status)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("earnings.checkin_label")}: {formatDate(b.check_in_date)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("earnings.services_label")}: {b.services.slice(0, 3).join(", ")}{b.services.length > 3 ? ` ${t("earnings.more_count", { count: b.services.length - 3 })}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        {formatMoney(b.total)}
                      </p>
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

function EmptyState({ icon: Icon, message, help }: { icon: any; message: string; help: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 text-center">
      <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">{help}</p>
    </div>
  );
}
