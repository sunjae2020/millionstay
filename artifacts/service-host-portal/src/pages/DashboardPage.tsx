import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { Briefcase, Clock, CheckCircle2, DollarSign, ArrowRight, Calendar } from "lucide-react";
import { ScheduleCalendar, type CalendarItem } from "@/components/ScheduleCalendar";

interface DashboardData {
  account_name: string;
  stats: {
    total_jobs: number;
    pending_jobs: number;
    completed_jobs: number;
    total_earnings: string;
  };
  recent_jobs: {
    id: number;
    name: string;
    service_type: string;
    total_price: string;
    currency: string;
    billing_trigger: string;
    booking: {
      booking_ref: string;
      booking_status: string;
      check_in_date: string;
      check_out_date: string;
    } | null;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Confirmed: "bg-blue-100 text-blue-700",
  CheckedOut: "bg-gray-100 text-gray-600",
  Draft: "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [scheduleItems, setScheduleItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: DashboardData }>("/v1/service-host/dashboard")
      .then((r) => { if (r.success) setData(r.data); })
      .catch(() => setError(t("dashboard.load_failed")))
      .finally(() => setLoading(false));
    apiGet<{ success: boolean; data: CalendarItem[] }>("/v1/service-host/schedule")
      .then((r) => { if (r.success) setScheduleItems(r.data); })
      .catch(() => {})
      .finally(() => setScheduleLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("dashboard.welcome")}, {user?.first_name ?? "—"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.account_name}</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Briefcase} label={t("dashboard.stat_total_jobs")} value={String(data?.stats.total_jobs ?? 0)} color="text-primary" />
            <StatCard icon={Clock} label={t("dashboard.stat_pending")} value={String(data?.stats.pending_jobs ?? 0)} color="text-yellow-600" />
            <StatCard icon={CheckCircle2} label={t("dashboard.stat_completed")} value={String(data?.stats.completed_jobs ?? 0)} color="text-green-600" />
            <StatCard icon={DollarSign} label={t("dashboard.stat_total_earnings")} value={`$${parseFloat(data?.stats.total_earnings ?? "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} color="text-primary" />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> {t("dashboard.schedule_overview")}
            </h2>
            <Link href="/schedule">
              <span className="text-xs text-primary flex items-center gap-1 cursor-pointer hover:underline">
                {t("dashboard.full_schedule")} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          {scheduleLoading ? (
            <div className="h-[480px] bg-muted rounded-xl animate-pulse" />
          ) : (
            <ScheduleCalendar items={scheduleItems} compact />
          )}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{t("dashboard.recent_jobs")}</h2>
            <Link href="/jobs">
              <span className="text-xs text-primary flex items-center gap-1 cursor-pointer hover:underline">
                {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : data?.recent_jobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("dashboard.no_jobs")}</div>
          ) : (
            <div className="divide-y divide-border">
              {data?.recent_jobs.map((job) => (
                <div key={job.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{job.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.booking?.booking_ref ?? "—"} · {t(`trigger.${job.billing_trigger}`, job.billing_trigger)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      ${parseFloat(job.total_price).toFixed(2)} {job.currency}
                    </p>
                    {job.booking && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.booking.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(`status.${job.booking.booking_status}`, job.booking.booking_status)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{t("dashboard.quick_links")}</h2>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border">
            <Link href="/jobs">
              <div className="p-5 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Briefcase className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">{t("dashboard.qlink_jobs")}</p>
              </div>
            </Link>
            <Link href="/schedule">
              <div className="p-5 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Calendar className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">{t("dashboard.qlink_schedule")}</p>
              </div>
            </Link>
            <Link href="/earnings">
              <div className="p-5 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <DollarSign className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">{t("dashboard.qlink_earnings")}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
