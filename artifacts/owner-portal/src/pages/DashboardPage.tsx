import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Building2, BookOpen, DollarSign, TrendingUp, ArrowRight, Globe, ExternalLink, Inbox } from "lucide-react";
import { InquiryRow, type Inquiry } from "@/pages/InquiriesPage";

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

/** Discovery / status card for the owner's landing site ("내 사이트"). */
function SiteBanner() {
  const { t } = useTranslation();
  const [site, setSite] = useState<{ slug: string; status: string } | null | undefined>(undefined);

  useEffect(() => {
    apiGet<{ success: boolean; data: { slug: string; status: string } | null }>("/v1/owner/site")
      .then((d) => setSite(d.data))
      .catch(() => setSite(null));
  }, []);

  if (site === undefined) return null;
  const url = site?.slug ? `https://${site.slug}.millionstay.com` : null;

  return (
    <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          {site ? (
            <>
              <p className="font-medium text-foreground">{t("dashboard.site_live_title", "Your landing site")}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {url && (
                  <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 truncate">
                    {url.replace("https://", "")} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
                {site.status !== "published" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    {t("dashboard.site_draft_badge", "Draft")}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">{t("dashboard.site_cta_title", "Create your own landing site")}</p>
              <p className="text-sm text-muted-foreground">{t("dashboard.site_cta_sub", "A public page where guests browse and book only your accommodation.")}</p>
            </>
          )}
        </div>
      </div>
      <Link href="/site">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap">
          {site ? t("dashboard.site_manage", "Manage site") : t("dashboard.site_get_started", "Get started")}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}

/** Recent landing-site inquiries preview for the dashboard. */
function RecentInquiries() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Inquiry[] | null>(null);

  useEffect(() => {
    apiGet<{ success: boolean; data: Inquiry[] }>("/v1/owner/site/inquiries?limit=5")
      .then((d) => setItems(d.data))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-6 bg-card border border-card-border rounded-xl">
      <div className="flex items-center justify-between p-6 border-b border-card-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" /> {t("dashboard.recent_inquiries", "Recent inquiries")}
        </h2>
        <Link href="/inquiries">
          <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
            {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>
      <div className="divide-y divide-border">
        {items.map((q) => <InquiryRow key={q.id} q={q} />)}
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
  const { t } = useTranslation();
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
          {t("dashboard.welcome")}{user?.first_name ? `, ${user.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${t("dashboard.account_prefix")} ${data.account_name}` : t("dashboard.subtitle_default")}
        </p>
      </div>

      <SiteBanner />

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
            <StatCard label={t("dashboard.stat_properties")} value={data.stats.total_properties} sub={t("dashboard.stat_spaces_sub", { count: data.stats.total_spaces })} icon={Building2} iconCls="bg-blue-50 text-blue-600" />
            <StatCard label={t("dashboard.stat_active_bookings")} value={data.stats.active_bookings} icon={BookOpen} iconCls="bg-green-50 text-green-600" />
            <StatCard label={t("dashboard.stat_monthly_revenue")} value={`$${Number(data.stats.monthly_revenue ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard label={t("dashboard.stat_total_properties")} value={data.properties.length} icon={TrendingUp} iconCls="bg-yellow-50 text-yellow-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-card-border rounded-xl">
              <div className="flex items-center justify-between p-6 border-b border-card-border">
                <h2 className="font-semibold text-foreground">{t("dashboard.recent_bookings")}</h2>
                <Link href="/bookings">
                  <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                    {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {data.recent_bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">{t("dashboard.no_bookings")}</p>
                ) : (
                  data.recent_bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground font-mono">{b.booking_ref ?? `#${b.id}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("dashboard.checkin_label")}: {b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : t("common.tbd")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">${Number(b.agreed_weekly_rate ?? 0).toLocaleString()}/wk</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {t(`status.${b.booking_status}`, b.booking_status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl">
              <div className="flex items-center justify-between p-6 border-b border-card-border">
                <h2 className="font-semibold text-foreground">{t("dashboard.my_properties")}</h2>
                <Link href="/properties">
                  <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                    {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {data.properties.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">{t("dashboard.no_properties")}</p>
                ) : (
                  data.properties.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.city}, {p.state}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.approval_status === "Approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {t(`status.${p.approval_status}`, p.approval_status)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <RecentInquiries />
        </>
      )}
    </Layout>
  );
}
