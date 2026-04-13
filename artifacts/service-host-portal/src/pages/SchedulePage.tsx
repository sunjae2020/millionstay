import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { CalendarDays, MapPin, Clock, ChevronDown } from "lucide-react";

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

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatShortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function groupByMonth(items: ScheduleItem[]) {
  const map: Record<string, ScheduleItem[]> = {};
  for (const item of items) {
    const key = item.scheduled_date
      ? new Date(item.scheduled_date).toLocaleDateString("en-AU", { month: "long", year: "numeric" })
      : "Unscheduled";
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

function triggerLabel(trigger: string) {
  if (trigger === "at_checkin") return "Check-In Service";
  if (trigger === "at_checkout") return "Check-Out Service";
  if (trigger === "at_booking") return "Booking Service";
  return trigger;
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
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiGet<{ success: boolean; data: ScheduleItem[] }>("/v1/service-host/schedule")
      .then((r) => { if (r.success) setItems(r.data); })
      .catch(() => setError("Failed to load schedule"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = groupByMonth(items);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">Your upcoming service assignments by date</p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />Check-In</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />Check-Out</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />At Booking</span>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No scheduled jobs</p>
            <p className="text-xs text-muted-foreground mt-1">Your service schedule will appear here once jobs are assigned</p>
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
                    <span className="text-xs text-muted-foreground">({monthItems.length} job{monthItems.length !== 1 ? "s" : ""})</span>
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
                                  {item.booking_status}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {triggerLabel(item.billing_trigger)} · {item.scheduled_date ? formatDate(item.scheduled_date) : "TBD"}
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
                                Stay: {formatShortDate(item.check_in_date)} → {formatShortDate(item.check_out_date)}
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
