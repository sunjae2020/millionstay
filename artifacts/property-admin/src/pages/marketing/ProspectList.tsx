import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Upload, Trash2, UserPlus } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { listProspects, deleteProspect, type Prospect } from "@/lib/marketing/api";
import { ProspectImportWizard } from "@/components/marketing/ProspectImportWizard";
import { ConvertToAccountModal } from "@/components/marketing/ConvertToAccountModal";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 border-gray-200",
  queued: "bg-slate-100 text-slate-700 border-slate-200",
  contacted: "bg-blue-100 text-blue-700 border-blue-200",
  opened: "bg-indigo-100 text-indigo-700 border-indigo-200",
  clicked: "bg-violet-100 text-violet-700 border-violet-200",
  replied: "bg-amber-100 text-amber-700 border-amber-200",
  converted: "bg-green-100 text-green-700 border-green-200",
  unsubscribed: "bg-orange-100 text-orange-700 border-orange-200",
  bounced: "bg-red-100 text-red-700 border-red-200",
  disqualified: "bg-red-50 text-red-500 border-red-100",
};

const SEGMENTS = ["owner", "agency", "corporate", "education", "service"] as const;
const STATUSES = Object.keys(STATUS_COLORS);

export default function ProspectList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<Prospect | null>(null);

  const params = {
    search: search || undefined,
    segment: segment || undefined,
    prospect_status: statusFilter || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "prospects", params],
    queryFn: () => listProspects(params),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["marketing", "prospects"] });

  async function handleDelete(row: Prospect) {
    try {
      await deleteProspect(row.id);
      toast({ title: t("marketing.prospect_deleted") });
      invalidate();
    } catch {
      toast({ title: t("marketing.prospect_delete_failed"), variant: "destructive" });
    }
  }

  const columns: ColumnDef<Prospect>[] = useMemo(
    () => [
      {
        key: "company_name",
        header: "marketing.company_name",
        defaultWidth: 200,
        hideable: false,
        cell: (r) => (
          <Link href={`/marketing/prospects/${r.id}`} className="font-medium text-primary hover:underline">
            {r.company_name}
          </Link>
        ),
      },
      {
        key: "contact_name",
        header: "marketing.contact_person",
        defaultWidth: 140,
        cell: (r) => (
          <span>
            {r.contact_name || "—"}
            {r.contact_title ? <span className="text-muted-foreground text-xs ml-1">{r.contact_title}</span> : null}
          </span>
        ),
      },
      { key: "email", header: "common.email", defaultWidth: 220, cell: (r) => <span className="text-sm">{r.email}</span> },
      {
        key: "segment",
        header: "marketing.segment",
        defaultWidth: 120,
        cell: (r) => (r.segment ? t(`marketing.segment_${r.segment}`, { defaultValue: r.segment }) : "—"),
      },
      {
        key: "prospect_status",
        header: "common.status",
        defaultWidth: 120,
        cell: (r) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              STATUS_COLORS[r.prospect_status] ?? "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {t(`marketing.status_${r.prospect_status}`, { defaultValue: r.prospect_status })}
          </span>
        ),
      },
      {
        key: "consent_basis",
        header: "marketing.consent_basis",
        defaultWidth: 130,
        cell: (r) => (
          <span className={r.consent_basis === "none" ? "text-red-600 text-xs" : "text-xs"}>
            {t(`marketing.consent_${r.consent_basis}`, { defaultValue: r.consent_basis })}
          </span>
        ),
      },
      { key: "country", header: "marketing.country", defaultWidth: 100, defaultHidden: true, cell: (r) => r.country || "—" },
      { key: "phone", header: "common.phone", defaultWidth: 130, defaultHidden: true, cell: (r) => r.phone || "—" },
      {
        key: "qualification_score",
        header: "marketing.score",
        align: "right",
        defaultWidth: 90,
        cell: (r) => r.qualification_score,
      },
      {
        key: "updated_at",
        header: "common.updated_at",
        defaultWidth: 120,
        cell: (r) => formatDate(r.updated_at),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        defaultWidth: 100,
        cell: (r) => (
          <div className="flex items-center gap-1">
            {!r.converted_account_id && (
              <Button variant="ghost" size="icon" title={t("marketing.convert")} onClick={() => setConvertTarget(r)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" title={t("common.delete")} onClick={() => void handleDelete(r)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("marketing.prospects")}
        subtitle={t("marketing.prospects_desc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              {t("marketing.import_csv")}
            </Button>
            <Link href="/marketing/prospects/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("marketing.new_prospect")}
              </Button>
            </Link>
          </div>
        }
      />

      <DataTable
        tableKey="marketing_prospects"
        columns={columns}
        data={data}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        defaultSort={{ key: "updated_at", dir: "desc" }}
        selection={{ enable: true, resource: "marketing/prospects", onChanged: invalidate }}
        showDeleted={showDeleted}
        onToggleShowDeleted={setShowDeleted}
        emptyText={t("marketing.no_prospects")}
        toolbarExtra={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("marketing.search_prospects")}
                className="pl-8 w-56"
              />
            </div>
            <Select value={segment || "all"} onValueChange={(v) => setSegment(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("marketing.segment")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`marketing.segment_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`marketing.status_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <ProspectImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          setImportOpen(false);
          invalidate();
        }}
      />

      <ConvertToAccountModal
        prospect={convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
        onConverted={() => {
          setConvertTarget(null);
          invalidate();
        }}
      />
    </Layout>
  );
}
