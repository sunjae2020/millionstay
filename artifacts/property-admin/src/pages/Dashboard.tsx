import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { apiFetch } from "@/lib/apiFetch";
import {
  useListSuburbs, useListProperties, useListSpaces, useListSpaceOptions,
  useListSpacePolicies, useListContacts, useListAccounts, useListTasks,
  useListLeads, useListBookings, useListInvoices, useListWorkOrders,
} from "@workspace/api-client-react";
import {
  MapPin, Building2, Layers, Tag, Settings, TrendingUp, Users, User,
  CheckSquare, Megaphone, AlertTriangle, CalendarDays, LogIn, LogOut, Clock,
  Receipt, Wrench, DollarSign, FileText,
} from "lucide-react";

function StatCard({
  label, value, icon: Icon, color, sublabel,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sublabel?: string;
}) {
  return (
    <div className="bg-card rounded-lg border p-5 flex items-start gap-4">
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">
          {value === undefined ? "—" : value}
        </p>
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

const CALENDAR_COLORS: Record<string, string> = {
  Draft: "#9ca3af",
  PendingPayment: "#eab308",
  PendingApproval: "#f59e0b",
  Confirmed: "#3b82f6",
  Active: "#22c55e",
  CheckedOut: "#6366f1",
  Cancelled: "#ef4444",
  NoShow: "#ec4899",
};

function BookingMiniCalendar({ bookings }: { bookings: any[] }) {
  const today = new Date();
  const dates: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const spaces = Array.from(new Set(
    bookings
      .filter((b) => b.space_id && !["Cancelled", "CheckedOut"].includes(b.booking_status))
      .map((b) => b.space_id)
  ));

  const spaceNames: Record<number, string> = {};
  bookings.forEach((b) => { if (b.space_id) spaceNames[b.space_id] = b.space_name ?? `Space #${b.space_id}`; });

  const { t } = useTranslation();

  if (spaces.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{t("dashboard.no_bookings")}</p>;
  }

  function getBookingForSpaceDate(spaceId: number, date: Date) {
    const ds = date.toISOString().slice(0, 10);
    return bookings.find((b) => b.space_id === spaceId && b.check_in_date && b.check_out_date && ds >= b.check_in_date && ds < b.check_out_date);
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b">
          <div className="w-36 shrink-0 px-2 py-1.5 text-xs font-semibold text-muted-foreground">Space</div>
          {dates.map((d) => (
            <div key={d.toISOString()} className={`w-16 shrink-0 text-center py-1.5 border-l text-xs ${d.toDateString() === today.toDateString() ? "bg-blue-50 text-blue-700 font-bold" : "text-muted-foreground"}`}>
              <div>{d.getDate()}</div>
              <div className="text-[10px]">{d.toLocaleDateString("en", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
        {spaces.map((spaceId) => (
          <div key={spaceId} className="flex border-b hover:bg-gray-50">
            <div className="w-36 shrink-0 px-2 py-2 text-xs font-medium truncate">{spaceNames[spaceId!]}</div>
            {dates.map((d) => {
              const bk = getBookingForSpaceDate(spaceId!, d);
              return (
                <div key={d.toISOString()} className="w-16 shrink-0 border-l h-8 p-0.5">
                  {bk && (
                    <Link href={`/booking/bookings/${bk.id}`}>
                      <div
                        className="h-full w-full rounded-sm opacity-80 hover:opacity-100 transition-opacity text-white text-[10px] flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: CALENDAR_COLORS[bk.booking_status] ?? "#9ca3af" }}
                        title={`${bk.booking_ref}`}
                      >
                        {d.toISOString().slice(0, 10) === bk.check_in_date ? bk.booking_ref?.slice(-5) : ""}
                      </div>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 p-2 border-t">
        {Object.entries(CALENDAR_COLORS).slice(0, 6).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface IntegrationStatus {
  stripe: { configured: boolean; mode: string | null; error: string | null };
  cloudinary: { configured: boolean; storage_mb: string | null; error: string | null };
  resend: { configured: boolean; error: string | null };
  maps: { provider: string; configured: boolean };
  ical: { configured: boolean };
}

function IntegrationStatusWidget() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    apiFetch(`/api/v1/integrations/status?t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setStatus(d.data); })
      .catch(() => {});
  }, []);

  const items = status
    ? [
        {
          emoji: status.stripe.error ? "⚠️" : status.stripe.configured ? "✅" : "⚠️",
          label: "Stripe",
          note: status.stripe.error
            ? t("dashboard.error")
            : status.stripe.configured
            ? status.stripe.mode === "live"
              ? t("dashboard.live_mode")
              : t("dashboard.test_mode")
            : t("dashboard.not_configured"),
          warn: !status.stripe.configured || !!status.stripe.error,
        },
        {
          emoji: status.cloudinary.error ? "⚠️" : status.cloudinary.configured ? "✅" : "⚠️",
          label: "Cloudinary",
          note: status.cloudinary.error
            ? t("dashboard.error")
            : status.cloudinary.configured
            ? `${status.cloudinary.storage_mb ?? "?"}MB used`
            : t("dashboard.not_configured"),
          warn: !status.cloudinary.configured || !!status.cloudinary.error,
        },
        {
          emoji: status.resend.error ? "⚠️" : status.resend.configured ? "✅" : "⚠️",
          label: "Resend",
          note: status.resend.error ? t("dashboard.error") : status.resend.configured ? t("dashboard.connected") : t("dashboard.not_configured"),
          warn: !status.resend.configured || !!status.resend.error,
        },
        {
          emoji: "🗺️",
          label: "Maps",
          note: "OpenStreetMap",
          warn: false,
        },
      ]
    : [];

  const hasWarning = items.some((i) => i.warn);

  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t("dashboard.integrations")}</h3>
        <Link href="/settings/integrations" className="text-xs text-[#E8621A] hover:underline">
          {t("dashboard.manage")}
        </Link>
      </div>
      {!status ? (
        <p className="text-xs text-muted-foreground">{t("dashboard.loading")}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span>{item.emoji}</span>
              <span className="font-medium w-20 shrink-0">{item.label}</span>
              <span className={item.warn ? "text-amber-600" : "text-muted-foreground"}>{item.note}</span>
            </div>
          ))}
          {hasWarning && (
            <p className="text-xs text-amber-600 mt-2 pt-2 border-t">
              ⚠️ {t("dashboard.integration_warning")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: suburbs } = useListSuburbs();
  const { data: properties } = useListProperties();
  const { data: spaces } = useListSpaces();
  const { data: spaceOptions } = useListSpaceOptions();
  const { data: spacePolicies } = useListSpacePolicies();
  const { data: contacts } = useListContacts();
  const { data: accounts } = useListAccounts();
  const { data: tasks } = useListTasks({});
  const { data: leads } = useListLeads({});
  const { data: bookings } = useListBookings({});
  const { data: invoices } = useListInvoices({});
  const { data: workOrders } = useListWorkOrders({});

  const pendingProperties = properties?.filter((p) => p.approval_status === "Pending").length;
  const activeProperties = properties?.filter((p) => p.approval_status === "Active").length;
  const activeSpaces = spaces?.filter((s) => s.status === "Active").length;
  const guestAccounts = accounts?.filter((a) => a.account_type === "Guest").length;
  const spaceOwnerAccounts = accounts?.filter((a) => a.account_type === "SpaceOwner" || a.account_type === "Landlord").length;

  const today = new Date().toISOString().split("T")[0]!;
  const activeTasks = tasks?.filter((t) => t.task_status === "Todo" || t.task_status === "InProgress").length;
  const overdueTasks = tasks?.filter((t) => t.due_date && t.due_date < today && t.task_status !== "Done").length;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = oneWeekAgo.toISOString().split("T")[0]!;
  const newLeadsThisWeek = leads?.filter((l) => l.created_at.slice(0, 10) >= weekAgoStr).length;

  const todayCheckIns = bookings?.filter((b) => b.check_in_date === today && b.booking_status === "Confirmed").length;
  const todayCheckOuts = bookings?.filter((b) => b.check_out_date === today && b.booking_status === "Active").length;
  const pendingApprovals = bookings?.filter((b) => b.booking_status === "PendingApproval").length;
  const activeBookings = bookings?.filter((b) => b.booking_status === "Active").length;

  // Finance stats
  const draftInvoices = invoices?.filter((i) => i.status === "Draft").length;
  const sentInvoices = invoices?.filter((i) => i.status === "Sent").length;
  const paidInvoices = invoices?.filter((i) => i.status === "Paid").length;
  const totalRevenue = invoices
    ?.filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);

  // Maintenance stats
  const openWorkOrders = workOrders?.filter((w) => w.status === "Open").length;
  const inProgressWorkOrders = workOrders?.filter((w) => w.status === "InProgress").length;
  const urgentWorkOrders = workOrders?.filter((w) => w.priority === "Urgent" && w.status !== "Completed" && w.status !== "Cancelled").length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const completedThisMonth = workOrders?.filter((w) => w.status === "Completed" && w.completed_at?.slice(0, 7) === thisMonth).length;

  return (
    <Layout>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
      <div className="p-6 space-y-8">
        {/* Property Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.property_section")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label={t("dashboard.suburbs")} value={suburbs?.length} icon={MapPin} color="bg-blue-500" sublabel={t("dashboard.suburbs_sub")} />
            <StatCard label={t("dashboard.properties")} value={properties?.length} icon={Building2} color="bg-indigo-500" sublabel={`${pendingProperties ?? 0} ${t("dashboard.properties_sub")}`} />
            <StatCard label={t("dashboard.active_properties")} value={activeProperties} icon={TrendingUp} color="bg-green-500" sublabel={t("dashboard.active_properties_sub")} />
            <StatCard label={t("dashboard.spaces")} value={spaces?.length} icon={Layers} color="bg-purple-500" sublabel={`${activeSpaces ?? 0} ${t("dashboard.spaces_sub")}`} />
            <StatCard label={t("dashboard.space_options")} value={spaceOptions?.length} icon={Tag} color="bg-orange-500" sublabel={t("dashboard.space_options_sub")} />
            <StatCard label={t("dashboard.space_policies")} value={spacePolicies?.length} icon={Settings} color="bg-teal-500" sublabel={t("dashboard.space_policies_sub")} />
          </div>
        </div>

        {/* CRM Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.crm_section")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.total_contacts")} value={contacts?.length} icon={User} color="bg-sky-500" sublabel={t("dashboard.total_contacts_sub")} />
            <StatCard label={t("dashboard.total_accounts")} value={accounts?.length} icon={Users} color="bg-violet-500" sublabel={t("dashboard.total_accounts_sub")} />
            <StatCard label={t("dashboard.guests")} value={guestAccounts} icon={User} color="bg-blue-400" sublabel={t("dashboard.guests_sub")} />
            <StatCard label={t("dashboard.space_owners")} value={spaceOwnerAccounts} icon={Building2} color="bg-purple-400" sublabel={t("dashboard.space_owners_sub")} />
          </div>
        </div>

        {/* Sales Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.sales_section")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label={t("dashboard.active_tasks")} value={activeTasks} icon={CheckSquare} color="bg-blue-500" sublabel={t("dashboard.active_tasks_sub")} />
            <StatCard label={t("dashboard.new_leads")} value={newLeadsThisWeek} icon={Megaphone} color="bg-emerald-500" sublabel={t("dashboard.new_leads_sub")} />
            <StatCard label={t("dashboard.overdue_tasks")} value={overdueTasks} icon={AlertTriangle} color={overdueTasks ? "bg-red-500" : "bg-gray-400"} sublabel={t("dashboard.overdue_tasks_sub")} />
          </div>
        </div>

        {/* Booking Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.booking_section")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label={t("dashboard.today_checkins")} value={todayCheckIns} icon={LogIn} color="bg-green-500" sublabel={t("dashboard.today_checkins_sub")} />
            <StatCard label={t("dashboard.today_checkouts")} value={todayCheckOuts} icon={LogOut} color="bg-amber-500" sublabel={t("dashboard.today_checkouts_sub")} />
            <StatCard label={t("dashboard.pending_approvals")} value={pendingApprovals} icon={Clock} color={pendingApprovals ? "bg-amber-600" : "bg-gray-400"} sublabel={t("dashboard.pending_approvals_sub")} />
            <StatCard label={t("dashboard.active_bookings")} value={activeBookings} icon={CalendarDays} color="bg-emerald-600" sublabel={t("dashboard.active_bookings_sub")} />
          </div>

          {/* Booking Calendar Mini Widget */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{t("dashboard.booking_calendar")}</h3>
              <Link href="/booking/bookings" className="text-xs text-[#E8621A] hover:underline">{t("dashboard.view_all")}</Link>
            </div>
            <BookingMiniCalendar bookings={bookings ?? []} />
          </div>
        </div>

        {/* Finance Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.finance_section")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.draft_invoices")} value={draftInvoices} icon={FileText} color="bg-gray-400" sublabel={t("dashboard.draft_invoices_sub")} />
            <StatCard label={t("dashboard.sent_invoices")} value={sentInvoices} icon={Receipt} color="bg-blue-500" sublabel={t("dashboard.sent_invoices_sub")} />
            <StatCard label={t("dashboard.paid_invoices")} value={paidInvoices} icon={CheckSquare} color="bg-green-500" sublabel={t("dashboard.paid_invoices_sub")} />
            <StatCard
              label={t("dashboard.total_revenue")}
              value={totalRevenue !== undefined ? Math.round(totalRevenue) : undefined}
              icon={DollarSign}
              color="bg-emerald-600"
              sublabel={t("dashboard.total_revenue_sub")}
            />
          </div>
        </div>

        {/* Maintenance Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.maintenance_section")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.open_work_orders")} value={openWorkOrders} icon={Wrench} color="bg-blue-500" sublabel={t("dashboard.open_work_orders_sub")} />
            <StatCard label={t("dashboard.in_progress_work_orders")} value={inProgressWorkOrders} icon={Settings} color="bg-yellow-500" sublabel={t("dashboard.in_progress_work_orders_sub")} />
            <StatCard label={t("dashboard.urgent_work_orders")} value={urgentWorkOrders} icon={AlertTriangle} color={urgentWorkOrders ? "bg-red-500" : "bg-gray-400"} sublabel={t("dashboard.urgent_work_orders_sub")} />
            <StatCard label={t("dashboard.completed_work_orders")} value={completedThisMonth} icon={CheckSquare} color="bg-green-500" sublabel={t("dashboard.completed_work_orders_sub")} />
          </div>
        </div>

        {/* Integrations Status Widget */}
        <IntegrationStatusWidget />

        {/* Alerts */}
        <div className="space-y-3">
          {pendingProperties !== undefined && pendingProperties > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">
                {pendingProperties} propert{pendingProperties === 1 ? "y" : "ies"} waiting for approval
              </p>
              <p className="text-xs text-amber-600 mt-1">Go to Properties to review and approve pending listings.</p>
            </div>
          )}
          {overdueTasks !== undefined && overdueTasks > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800">
                {overdueTasks} overdue task{overdueTasks === 1 ? "" : "s"} need attention
              </p>
              <p className="text-xs text-red-600 mt-1">Go to Tasks to review and complete overdue items.</p>
            </div>
          )}
          {pendingApprovals !== undefined && pendingApprovals > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">
                {pendingApprovals} booking{pendingApprovals === 1 ? "" : "s"} pending approval
              </p>
              <p className="text-xs text-amber-600 mt-1">Go to Bookings to review and approve pending requests.</p>
            </div>
          )}
          {sentInvoices !== undefined && sentInvoices > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800">
                {sentInvoices} invoice{sentInvoices === 1 ? "" : "s"} awaiting payment
              </p>
              <p className="text-xs text-[#E8621A] mt-1">Go to Finance → Invoices to follow up on outstanding payments.</p>
            </div>
          )}
          {urgentWorkOrders !== undefined && urgentWorkOrders > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800">
                {urgentWorkOrders} urgent work order{urgentWorkOrders === 1 ? "" : "s"} require immediate attention
              </p>
              <p className="text-xs text-red-600 mt-1">Go to Maintenance → Work Orders to address urgent issues.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
