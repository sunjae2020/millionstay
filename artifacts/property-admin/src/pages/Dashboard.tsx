import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
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

  if (spaces.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No active bookings in the next 7 days.</p>;
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

export default function Dashboard() {
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
      <PageHeader title="Dashboard" subtitle="MillionStay admin overview" />
      <div className="p-6 space-y-8">
        {/* Property Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Property</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Suburbs" value={suburbs?.length} icon={MapPin} color="bg-blue-500" sublabel="Registered locations" />
            <StatCard label="Properties" value={properties?.length} icon={Building2} color="bg-indigo-500" sublabel={`${pendingProperties ?? 0} pending approval`} />
            <StatCard label="Active Properties" value={activeProperties} icon={TrendingUp} color="bg-green-500" sublabel="Approved listings" />
            <StatCard label="Spaces" value={spaces?.length} icon={Layers} color="bg-purple-500" sublabel={`${activeSpaces ?? 0} active`} />
            <StatCard label="Space Options" value={spaceOptions?.length} icon={Tag} color="bg-orange-500" sublabel="Amenity tags" />
            <StatCard label="Space Policies" value={spacePolicies?.length} icon={Settings} color="bg-teal-500" sublabel="House rules templates" />
          </div>
        </div>

        {/* CRM Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">CRM</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Contacts" value={contacts?.length} icon={User} color="bg-sky-500" sublabel="All registered contacts" />
            <StatCard label="Total Accounts" value={accounts?.length} icon={Users} color="bg-violet-500" sublabel="All account types" />
            <StatCard label="Guests" value={guestAccounts} icon={User} color="bg-blue-400" sublabel="Guest accounts" />
            <StatCard label="Space Owners" value={spaceOwnerAccounts} icon={Building2} color="bg-purple-400" sublabel="Landlord / SpaceOwner" />
          </div>
        </div>

        {/* Sales Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Active Tasks" value={activeTasks} icon={CheckSquare} color="bg-blue-500" sublabel="Todo + In Progress" />
            <StatCard label="New Leads This Week" value={newLeadsThisWeek} icon={Megaphone} color="bg-emerald-500" sublabel="Created in last 7 days" />
            <StatCard label="Overdue Tasks" value={overdueTasks} icon={AlertTriangle} color={overdueTasks ? "bg-red-500" : "bg-gray-400"} sublabel="Past due date, not done" />
          </div>
        </div>

        {/* Booking Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Booking</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Today's Check-Ins" value={todayCheckIns} icon={LogIn} color="bg-green-500" sublabel="Confirmed, checking in today" />
            <StatCard label="Today's Check-Outs" value={todayCheckOuts} icon={LogOut} color="bg-amber-500" sublabel="Active, checking out today" />
            <StatCard label="Pending Approvals" value={pendingApprovals} icon={Clock} color={pendingApprovals ? "bg-amber-600" : "bg-gray-400"} sublabel="Bookings awaiting approval" />
            <StatCard label="Active Bookings" value={activeBookings} icon={CalendarDays} color="bg-emerald-600" sublabel="Currently checked in" />
          </div>

          {/* Booking Calendar Mini Widget */}
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Booking Calendar (Next 7 Days)</h3>
              <Link href="/booking/bookings" className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <BookingMiniCalendar bookings={bookings ?? []} />
          </div>
        </div>

        {/* Finance Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Finance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Draft Invoices" value={draftInvoices} icon={FileText} color="bg-gray-400" sublabel="Not yet sent" />
            <StatCard label="Sent Invoices" value={sentInvoices} icon={Receipt} color="bg-blue-500" sublabel="Awaiting payment" />
            <StatCard label="Paid Invoices" value={paidInvoices} icon={CheckSquare} color="bg-green-500" sublabel="Payments received" />
            <StatCard
              label="Revenue Collected"
              value={totalRevenue !== undefined ? Math.round(totalRevenue) : undefined}
              icon={DollarSign}
              color="bg-emerald-600"
              sublabel="AUD from paid invoices"
            />
          </div>
        </div>

        {/* Maintenance Section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Maintenance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open Work Orders" value={openWorkOrders} icon={Wrench} color="bg-blue-500" sublabel="Not yet started" />
            <StatCard label="In Progress" value={inProgressWorkOrders} icon={Settings} color="bg-yellow-500" sublabel="Currently being worked on" />
            <StatCard label="Urgent" value={urgentWorkOrders} icon={AlertTriangle} color={urgentWorkOrders ? "bg-red-500" : "bg-gray-400"} sublabel="High priority open orders" />
            <StatCard label="Completed This Month" value={completedThisMonth} icon={CheckSquare} color="bg-green-500" sublabel="Closed in current month" />
          </div>
        </div>

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
              <p className="text-xs text-blue-600 mt-1">Go to Finance → Invoices to follow up on outstanding payments.</p>
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
