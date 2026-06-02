import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiFetch";
import {
  useListSuburbs, useListProperties, useListSpaces,
  useListContacts, useListAccounts, useListTasks, useListLeads,
  useListBookings, useListInvoices, useListWorkOrders,
} from "@workspace/api-client-react";
import {
  BedDouble, LogIn, LogOut, DollarSign, CalendarDays, Building2, Layers,
  Users, TrendingUp, AlertTriangle, Plus, Receipt, Wrench, FileText,
  Activity, ArrowRight, CheckSquare,
} from "lucide-react";
import { KpiCard, DashCard, BRAND, BRAND_SOFT } from "@/components/dashboard/DashboardKit";

const CAL_COLORS: Record<string, string> = {
  Draft: "#9ca3af", PendingPayment: "#eab308", PendingApproval: "#f59e0b",
  Confirmed: "#3b82f6", Active: "#22c55e", CheckedOut: "#6366f1",
  Cancelled: "#ef4444", NoShow: "#ec4899",
};

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600", PendingPayment: "bg-yellow-100 text-yellow-800",
  PendingApproval: "bg-orange-100 text-orange-800", Confirmed: "bg-blue-100 text-blue-800",
  Active: "bg-green-100 text-green-700", CheckedOut: "bg-indigo-100 text-indigo-700",
  Cancelled: "bg-gray-100 text-gray-500",
};

function fmtMoney(n: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function MiniCalendar({ bookings }: { bookings: any[] }) {
  const today = new Date();
  const dates: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i); return d;
  });
  const spaces = Array.from(new Set(
    bookings
      .filter((b) => b.space_id && !["Cancelled", "CheckedOut"].includes(b.booking_status))
      .map((b) => b.space_id)
  )).slice(0, 8);
  const spaceNames: Record<number, string> = {};
  bookings.forEach((b) => { if (b.space_id) spaceNames[b.space_id] = b.space_name ?? `Space #${b.space_id}`; });

  function bookingFor(spaceId: number, date: Date) {
    const ds = date.toISOString().slice(0, 10);
    return bookings.find((b) => b.space_id === spaceId && b.check_in_date && b.check_out_date && ds >= b.check_in_date && ds < b.check_out_date);
  }

  if (spaces.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No upcoming bookings</p>;
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b">
          <div className="w-32 shrink-0 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">Space</div>
          {dates.map((d) => (
            <div key={d.toISOString()} className={`w-14 shrink-0 text-center py-1.5 text-[11px] ${d.toDateString() === today.toDateString() ? "text-[#E8621A] font-bold" : "text-muted-foreground"}`}>
              <div>{d.getDate()}</div>
              <div className="text-[9px]">{d.toLocaleDateString("en", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
        {spaces.map((spaceId) => (
          <div key={spaceId} className="flex border-b last:border-b-0 hover:bg-muted/30">
            <div className="w-32 shrink-0 px-2 py-2 text-[11px] font-medium truncate">{spaceNames[spaceId!]}</div>
            {dates.map((d) => {
              const bk = bookingFor(spaceId!, d);
              return (
                <div key={d.toISOString()} className="w-14 shrink-0 h-8 p-0.5">
                  {bk && (
                    <Link href={`/booking/bookings/${bk.id}`}>
                      <div
                        className="h-full w-full rounded-sm opacity-85 hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: CAL_COLORS[bk.booking_status] ?? "#9ca3af" }}
                        title={bk.booking_ref}
                      />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 pt-3 mt-1 border-t">
        {["Active", "Confirmed", "PendingApproval", "Draft"].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CAL_COLORS[s] }} />
            <span className="text-[10px] text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActivityLog {
  id: number; entity_type: string; entity_id: number; action: string;
  actor_type: string; actor_email: string | null; created_at: string;
}

function activityEmoji(action: string) {
  if (action.includes("CHECK")) return "🔑";
  if (action.includes("CREAT")) return "➕";
  if (action.includes("UPDAT") || action.includes("STATUS")) return "✏️";
  if (action.includes("DELET") || action.includes("CANCEL")) return "🗑️";
  if (action.includes("SEND") || action.includes("EMAIL")) return "📧";
  return "📋";
}

function MiniStat({ icon: Icon, label, value, href }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; href: string;
}) {
  return (
    <Link href={href} className="bg-card rounded-xl border p-3 flex items-center gap-3 hover:shadow-sm hover:border-[#E8621A]/40 transition-all">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: BRAND_SOFT, color: BRAND }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{value ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </Link>
  );
}

export default function OverviewTab() {
  const { t } = useTranslation();
  const { data: suburbs } = useListSuburbs();
  const { data: properties } = useListProperties();
  const { data: spaces } = useListSpaces();
  const { data: contacts } = useListContacts();
  const { data: accounts } = useListAccounts();
  const { data: tasks } = useListTasks({});
  const { data: leads } = useListLeads({});
  const { data: bookings } = useListBookings({});
  const { data: invoices } = useListInvoices({});
  const { data: workOrders } = useListWorkOrders({});

  const [activity, setActivity] = useState<ActivityLog[]>([]);
  useEffect(() => {
    apiFetch("/api/v1/operations/activity-log?limit=8")
      .then(r => r.json())
      .then(d => setActivity(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const activeSpaces = spaces?.filter(s => s.status === "Active" || s.status === "Occupied").length ?? 0;
  const totalSpaces = spaces?.length ?? 0;
  const activeBookings = bookings?.filter(b => b.booking_status === "Active").length ?? 0;
  const occupancyPct = activeSpaces > 0 ? Math.min(100, Math.round((activeBookings / activeSpaces) * 100)) : 0;

  const todayCheckIns = bookings?.filter(b => b.check_in_date === today && (b.booking_status === "Confirmed" || b.booking_status === "PendingPayment")).length ?? 0;
  const todayCheckOuts = bookings?.filter(b => b.check_out_date === today && b.booking_status === "Active").length ?? 0;
  const pendingApprovals = bookings?.filter(b => b.booking_status === "PendingApproval").length ?? 0;

  const monthlyRevenue = (invoices ?? [])
    .filter(i => i.status === "Paid" && (i.created_at?.slice(0, 7) === thisMonth))
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const overdueInvoices = (invoices ?? []).filter(i => i.status === "Sent" && i.due_date && i.due_date < today).length;
  const overdueAmount = (invoices ?? [])
    .filter(i => i.status === "Sent" && i.due_date && i.due_date < today)
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);

  const urgentWO = workOrders?.filter(w => w.priority === "Urgent" && w.status !== "Completed" && w.status !== "Cancelled").length ?? 0;
  const overdueTasks = tasks?.filter(t => t.due_date && t.due_date < today && t.task_status !== "Done").length ?? 0;
  const pendingProperties = properties?.filter(p => p.approval_status === "Pending").length ?? 0;

  const recentBookings = [...(bookings ?? [])]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 6);

  const alerts = [
    overdueInvoices > 0 && { tone: "red" as const, text: `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? "" : "s"} (${fmtMoney(overdueAmount)})`, href: "/finance/invoices" },
    urgentWO > 0 && { tone: "red" as const, text: `${urgentWO} urgent work order${urgentWO === 1 ? "" : "s"} need attention`, href: "/maintenance/work-orders" },
    pendingApprovals > 0 && { tone: "amber" as const, text: `${pendingApprovals} booking${pendingApprovals === 1 ? "" : "s"} pending approval`, href: "/booking/bookings" },
    pendingProperties > 0 && { tone: "amber" as const, text: `${pendingProperties} propert${pendingProperties === 1 ? "y" : "ies"} awaiting approval`, href: "/property/properties" },
    overdueTasks > 0 && { tone: "amber" as const, text: `${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}`, href: "/account/tasks" },
  ].filter(Boolean) as { tone: "red" | "amber"; text: string; href: string }[];

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={BedDouble} accent="brand" label="Occupancy"
          value={`${occupancyPct}%`} sublabel={`${activeBookings} active · ${totalSpaces} spaces`}
          progress={occupancyPct}
        />
        <KpiCard
          icon={LogIn} accent="green" label="Today's Check-ins"
          value={todayCheckIns} sublabel={pendingApprovals > 0 ? `${pendingApprovals} pending approval` : "All confirmed"}
        />
        <KpiCard
          icon={LogOut} accent="blue" label="Today's Check-outs"
          value={todayCheckOuts} sublabel={`${todayCheckOuts} departures scheduled`}
        />
        <KpiCard
          icon={DollarSign} accent="purple" label="Revenue This Month"
          value={fmtMoney(monthlyRevenue)} sublabel={new Date().toLocaleDateString("en", { month: "long", year: "numeric" })}
          trend={monthlyRevenue > 0 ? "Paid" : undefined} trendType="up"
        />
      </div>

      {/* Calendar + Quick actions/Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          className="lg:col-span-2"
          title="7-Day Booking Calendar"
          icon={CalendarDays}
          action={<Link href="/dashboard?tab=reservations" className="text-xs text-[#E8621A] hover:underline">Open reservations →</Link>}
        >
          <MiniCalendar bookings={bookings ?? []} />
        </DashCard>

        <div className="space-y-4">
          <DashCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/booking/bookings/new" className="flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold text-muted-foreground hover:border-[#E8621A]/50 hover:text-[#E8621A] hover:bg-[#E8621A]/5 transition-all">
                <Plus className="h-4 w-4" /> New Booking
              </Link>
              <Link href="/finance/invoices/new" className="flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold text-muted-foreground hover:border-[#E8621A]/50 hover:text-[#E8621A] hover:bg-[#E8621A]/5 transition-all">
                <Receipt className="h-4 w-4" /> Invoice
              </Link>
              <Link href="/property/properties/new" className="flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold text-muted-foreground hover:border-[#E8621A]/50 hover:text-[#E8621A] hover:bg-[#E8621A]/5 transition-all">
                <Building2 className="h-4 w-4" /> Property
              </Link>
              <Link href="/maintenance/work-orders/new" className="flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold text-muted-foreground hover:border-[#E8621A]/50 hover:text-[#E8621A] hover:bg-[#E8621A]/5 transition-all">
                <Wrench className="h-4 w-4" /> Work Order
              </Link>
            </div>
          </DashCard>

          <DashCard title="Alerts" icon={AlertTriangle}>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">All clear — nothing needs attention 🎉</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <Link
                    key={i}
                    href={a.href}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      a.tone === "red"
                        ? "bg-red-50 border-red-200 text-red-800 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300"
                        : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{a.text}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
                  </Link>
                ))}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      {/* Recent bookings + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          className="lg:col-span-2"
          title="Recent Bookings"
          icon={CalendarDays}
          bodyClass="p-0"
          action={<Link href="/booking/bookings" className="text-xs text-[#E8621A] hover:underline">View all →</Link>}
        >
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {["Ref #", "Guest", "Space", "Check-in", "Amount", "Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentBookings.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No bookings yet</td></tr>
                ) : recentBookings.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-medium">
                      <Link href={`/booking/bookings/${b.id}`} className="hover:text-[#E8621A]">{b.booking_ref}</Link>
                    </td>
                    <td className="px-3 py-2">{(b as any).contact_name ?? "—"}</td>
                    <td className="px-3 py-2">{(b as any).space_name ?? "—"}</td>
                    <td className="px-3 py-2">{b.check_in_date ?? "—"}</td>
                    <td className="px-3 py-2">{b.total_rent ? `${b.currency ?? "AUD"} ${parseFloat(b.total_rent).toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                        {b.booking_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>

        <DashCard title="Activity Feed" icon={Activity} bodyClass="p-0">
          <div className="divide-y max-h-[340px] overflow-auto">
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No recent activity</p>
            ) : activity.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-base mt-0.5 shrink-0">{activityEmoji(log.action)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-medium">{log.action.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="text-muted-foreground"> · {log.entity_type} #{log.entity_id}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.actor_email ?? log.actor_type} · {relTime(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      {/* Portfolio mini-stats */}
      <div>
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.property_section", "Portfolio")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MiniStat icon={Building2} label="Properties" value={properties?.length} href="/property/properties" />
          <MiniStat icon={Layers} label="Spaces" value={totalSpaces} href="/property/spaces" />
          <MiniStat icon={TrendingUp} label="Active Spaces" value={activeSpaces} href="/property/spaces" />
          <MiniStat icon={Users} label="Contacts" value={contacts?.length} href="/account/contacts" />
          <MiniStat icon={FileText} label="Accounts" value={accounts?.length} href="/account/accounts" />
          <MiniStat icon={CheckSquare} label="Open Tasks" value={tasks?.filter(t => t.task_status !== "Done").length} href="/account/tasks" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <MiniStat icon={TrendingUp} label="Leads" value={leads?.length} href="/account/leads" />
          <MiniStat icon={CalendarDays} label="Suburbs" value={suburbs?.length} href="/settings/suburbs" />
        </div>
      </div>
    </div>
  );
}
