import { Layout, PageHeader } from "@/components/Layout";
import { useListSuburbs, useListProperties, useListSpaces, useListSpaceOptions, useListSpacePolicies, useListContacts, useListAccounts, useListTasks, useListLeads } from "@workspace/api-client-react";
import { MapPin, Building2, Layers, Tag, Settings, TrendingUp, Users, User, CheckSquare, Megaphone, AlertTriangle } from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sublabel,
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
            <StatCard
              label="Active Tasks"
              value={activeTasks}
              icon={CheckSquare}
              color="bg-blue-500"
              sublabel="Todo + In Progress"
            />
            <StatCard
              label="New Leads This Week"
              value={newLeadsThisWeek}
              icon={Megaphone}
              color="bg-emerald-500"
              sublabel="Created in last 7 days"
            />
            <StatCard
              label="Overdue Tasks"
              value={overdueTasks}
              icon={AlertTriangle}
              color={overdueTasks ? "bg-red-500" : "bg-gray-400"}
              sublabel="Past due date, not done"
            />
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
        </div>
      </div>
    </Layout>
  );
}
