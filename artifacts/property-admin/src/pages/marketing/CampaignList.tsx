import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { listCampaigns, createCampaign, type Campaign } from "@/lib/marketing/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  ready: "bg-slate-100 text-slate-700 border-slate-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  sending: "bg-indigo-100 text-indigo-700 border-indigo-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

export default function CampaignList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "campaigns", showDeleted],
    queryFn: () => listCampaigns(),
  });

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createCampaign({ name: t("marketing.untitled_campaign") });
      navigate(`/marketing/campaigns/${created.id}`);
    } catch {
      toast({ title: t("marketing.save_failed"), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  const columns: ColumnDef<Campaign>[] = useMemo(
    () => [
      {
        key: "name",
        header: "marketing.campaign_name",
        defaultWidth: 240,
        hideable: false,
        cell: (r) => (
          <Link href={`/marketing/campaigns/${r.id}`} className="font-medium text-primary hover:underline">
            {r.name}
          </Link>
        ),
      },
      {
        key: "status",
        header: "common.status",
        defaultWidth: 110,
        cell: (r) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {t(`marketing.campaign_status_${r.status}`, { defaultValue: r.status })}
          </span>
        ),
      },
      { key: "total_recipients", header: "marketing.recipients", align: "right", defaultWidth: 100, cell: (r) => r.total_recipients },
      { key: "sent_count", header: "marketing.sent", align: "right", defaultWidth: 90, cell: (r) => r.sent_count },
      { key: "opened_count", header: "marketing.opened", align: "right", defaultWidth: 90, cell: (r) => r.opened_count },
      { key: "clicked_count", header: "marketing.clicked", align: "right", defaultWidth: 90, cell: (r) => r.clicked_count },
      {
        key: "bounced_count",
        header: "marketing.bounced",
        align: "right",
        defaultWidth: 90,
        defaultHidden: true,
        cell: (r) => r.bounced_count,
      },
      {
        key: "scheduled_at",
        header: "marketing.scheduled_at",
        defaultWidth: 120,
        cell: (r) => (r.scheduled_at ? formatDate(r.scheduled_at) : "—"),
      },
      { key: "updated_at", header: "common.updated_at", defaultWidth: 120, cell: (r) => formatDate(r.updated_at) },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("marketing.campaigns")}
        subtitle={t("marketing.campaigns_desc")}
        actions={
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {t("marketing.new_campaign")}
          </Button>
        }
      />
      <DataTable
        tableKey="marketing_campaigns"
        columns={columns}
        data={data}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        defaultSort={{ key: "updated_at", dir: "desc" }}
        selection={{
          enable: true,
          resource: "marketing/campaigns",
          onChanged: () => qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] }),
        }}
        showDeleted={showDeleted}
        onToggleShowDeleted={setShowDeleted}
        emptyText={t("marketing.no_campaigns")}
      />
    </Layout>
  );
}
