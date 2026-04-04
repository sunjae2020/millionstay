import { Layout, PageHeader } from "@/components/Layout";
import { useListSuburbs } from "@workspace/api-client-react";
import { useListProperties } from "@workspace/api-client-react";
import { useListSpaces } from "@workspace/api-client-react";
import { useListSpaceOptions } from "@workspace/api-client-react";
import { useListSpacePolicies } from "@workspace/api-client-react";
import { MapPin, Building2, Layers, Tag, Settings, TrendingUp } from "lucide-react";

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

  const pendingProperties = properties?.filter((p) => p.approval_status === "Pending").length;
  const activeProperties = properties?.filter((p) => p.approval_status === "Active").length;
  const activeSpaces = spaces?.filter((s) => s.status === "Active").length;

  return (
    <Layout>
      <PageHeader title="Dashboard" subtitle="Property module overview" />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Suburbs"
            value={suburbs?.length}
            icon={MapPin}
            color="bg-blue-500"
            sublabel="Registered locations"
          />
          <StatCard
            label="Properties"
            value={properties?.length}
            icon={Building2}
            color="bg-indigo-500"
            sublabel={`${pendingProperties ?? 0} pending approval`}
          />
          <StatCard
            label="Active Properties"
            value={activeProperties}
            icon={TrendingUp}
            color="bg-green-500"
            sublabel="Approved listings"
          />
          <StatCard
            label="Spaces"
            value={spaces?.length}
            icon={Layers}
            color="bg-purple-500"
            sublabel={`${activeSpaces ?? 0} active`}
          />
          <StatCard
            label="Space Options"
            value={spaceOptions?.length}
            icon={Tag}
            color="bg-orange-500"
            sublabel="Amenity tags"
          />
          <StatCard
            label="Space Policies"
            value={spacePolicies?.length}
            icon={Settings}
            color="bg-teal-500"
            sublabel="House rules templates"
          />
        </div>

        {/* Pending approvals */}
        {pendingProperties !== undefined && pendingProperties > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-800">
              {pendingProperties} propert{pendingProperties === 1 ? "y" : "ies"} waiting for approval
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Go to Properties to review and approve pending listings.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
