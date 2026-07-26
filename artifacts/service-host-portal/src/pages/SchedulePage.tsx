import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/dateFormat";
import { CalendarDays, MapPin, Clock, ChevronDown, List, CalendarRange } from "lucide-react";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";

interface ScheduleItem {
  id: number;
  service_name: string;
  service_type: string;
  total_price: string;
  currency: string;
  billing_trigger: string;
  booking_ref: string | null;
  booking_status: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  space_name: string | null;
  property_name: string | null;
  scheduled_date: string | null;
}

function formatShortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Confirmed: "bg-blue-100 text-blue-700",
  CheckedOut: "bg-gray-100 text-gray-600",
  Draft: "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-red-100 text-red-700",
};

const TRIGGER_COLORS: Record<string, string> = {
  at_checkin: "border-l-green-400",
  at_checkout: "border-l-orange-400",
  at_booking: "border-l-blue-400",
};

export default function SchedulePage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"list" | "calendar">("calendar");

  useEffect(() => {
    apiGet<{ success: boolean; data: ScheduleItem[] }>("/v1/service-host/schedule")
      .then((r) => { if (r.success) setItems(r.data); })
      .catch(() => setError(t("schedule.load_failed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function groupByMonth(items: ScheduleItem[]) {
    const map: Record<string, ScheduleItem[]> = {};
    for (const item of items) {
      const key = item.scheduled_date
        ? new Date(item.scheduled_date).toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : t("schedule.unscheduled");
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }

  const grouped = groupByMonth(items);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("schedule.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("schedule.subtitle")}</p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> {t("schedule.view_calendar")}
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <List className="w-3.5 h-3.5" /> {t("schedule.view_list")}
            </button>
          </div>
        </div>

        {view === "list" && (
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />{t("trigger.checkin")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />{t("trigger.checkout")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />{t("trigger.at_booking")}</span>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {view === "calendar" ? (
          loading ? (
            <div className="h-[600px] bg-muted rounded-xl animate-pulse" />
          ) : (
            <ScheduleCalendar items={items} />
          )
        ) : loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{t("schedule.no_jobs")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("schedule.no_jobs_help")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, monthItems]) => (
              <div key={month} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full px-5 py-3.5 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [month]: !prev[month] }))}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{month}</span>
                    <span className="text-xs text-muted-foreground">{t("schedule.month_jobs", { count: monthItems.length })}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed[month] ? "-rotate-90" : ""}`} />
                </button>

                {!collapsed[month] && (
                  <div className="divide-y divide-border">
                    {monthItems.map((item) => (
                      <div
                        key={item.id}
                        className={`px-5 py-4 border-l-4 ${TRIGGER_COLORS[item.billing_trigger] ?? "border-l-gray-300"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{item.service_name}</span>
                              {item.booking_status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {t(`status.${item.booking_status}`, item.booking_status)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t(`trigger.${item.billing_trigger.replace(/^at_/, "")}_service`, t(`trigger.${item.billing_trigger}`, item.billing_trigger))} · {item.scheduled_date ? formatDate(item.scheduled_date) : t("common.tbd")}
                              </span>
                              {item.property_name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {item.property_name}
                                  {item.space_name ? ` · ${item.space_name}` : ""}
                                </span>
                              )}
                              {item.booking_ref && (
                                <span className="font-mono text-primary">{item.booking_ref}</span>
                              )}
                            </div>
                            {item.check_in_date && item.check_out_date && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t("schedule.stay", { from: formatShortDate(item.check_in_date), to: formatShortDate(item.check_out_date) })}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-foreground">
                              ${parseFloat(item.total_price).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.currency}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
