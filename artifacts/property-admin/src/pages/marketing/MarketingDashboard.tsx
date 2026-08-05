import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import { getMarketingDashboard } from "@/lib/marketing/api";

const SEGMENT_COLORS = ["#E8621A", "#16263F", "#2F7A78", "#C08A2E", "#7A5AA8"];

export default function MarketingDashboard() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["marketing", "dashboard"], queryFn: getMarketingDashboard });

  if (isLoading || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const events = new Map(data.event_totals.map((e) => [e.event_type, e.count] as const));
  const sent = events.get("sent") ?? 0;
  const rate = (n: number) => (sent > 0 ? Math.round((n / sent) * 1000) / 10 : 0);

  const funnel = [
    { key: "sent", value: sent },
    { key: "delivered", value: events.get("delivered") ?? 0 },
    { key: "opened", value: events.get("opened") ?? 0 },
    { key: "clicked", value: events.get("clicked") ?? 0 },
    { key: "replied", value: events.get("replied") ?? 0 },
  ].map((row) => ({ ...row, label: t(`marketing.event_${row.key}`, { defaultValue: row.key }) }));

  const segments = data.prospects_by_segment.map((s) => ({
    name: t(`marketing.segment_${s.segment}`, { defaultValue: s.segment }),
    value: s.count,
  }));

  return (
    <Layout>
      <PageHeader title={t("marketing.dashboard")} subtitle={t("marketing.dashboard_desc")} />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("marketing.prospects")} value={data.prospects} />
          <Stat label={t("marketing.live_campaigns")} value={data.live_campaigns} />
          <Stat label={t("marketing.opened")} value={events.get("opened") ?? 0} sub={`${rate(events.get("opened") ?? 0)}%`} />
          <Stat label={t("marketing.clicked")} value={events.get("clicked") ?? 0} sub={`${rate(events.get("clicked") ?? 0)}%`} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("marketing.funnel")}</CardTitle></CardHeader>
            <CardContent className="h-64">
              {sent === 0 ? (
                <p className="text-sm text-muted-foreground">{t("marketing.no_events")}</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 24 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#E8621A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("marketing.by_segment")}</CardTitle></CardHeader>
            <CardContent className="h-64">
              {segments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("marketing.no_prospects")}</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segments} dataKey="value" nameKey="name" outerRadius={80} label>
                      {segments.map((_, i) => (
                        <Cell key={i} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("marketing.recent_campaigns")}</CardTitle></CardHeader>
          <CardContent>
            {data.recent_campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("marketing.no_campaigns")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">{t("marketing.campaign_name")}</th>
                    <th className="text-left p-2">{t("common.status")}</th>
                    <th className="text-right p-2">{t("marketing.recipients")}</th>
                    <th className="text-right p-2">{t("marketing.sent")}</th>
                    <th className="text-left p-2">{t("common.updated_at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_campaigns.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">
                        <Link href={`/marketing/campaigns/${c.id}`} className="text-primary hover:underline">{c.name}</Link>
                      </td>
                      <td className="p-2">{t(`marketing.campaign_status_${c.status}`, { defaultValue: c.status })}</td>
                      <td className="p-2 text-right">{c.total_recipients}</td>
                      <td className="p-2 text-right">{c.sent_count}</td>
                      <td className="p-2">{formatDate(c.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
