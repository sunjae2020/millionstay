import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListLeads, useUpdateLead, useDeleteLead, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, LayoutList, Kanban, ArrowRight } from "lucide-react";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { useToast } from "@/hooks/use-toast";

const LEAD_STATUSES = ["New", "Contacted", "Qualified", "ConvertedToBooking", "Lost"] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; header: string; badge: string; dot: string }> = {
  New:                { label: "New",       bg: "bg-slate-50 border-slate-200",   header: "bg-slate-100 text-slate-700",   badge: "bg-gray-100 text-gray-700 border-gray-200",    dot: "bg-slate-400" },
  Contacted:          { label: "Contacted", bg: "bg-blue-50 border-blue-200",     header: "bg-blue-100 text-blue-700",     badge: "bg-blue-100 text-blue-700 border-blue-200",    dot: "bg-blue-500" },
  Qualified:          { label: "Qualified", bg: "bg-amber-50 border-amber-200",   header: "bg-amber-100 text-amber-700",   badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  ConvertedToBooking: { label: "Converted", bg: "bg-green-50 border-green-200",   header: "bg-green-100 text-green-700",   badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  Lost:               { label: "Lost",      bg: "bg-red-50 border-red-200",       header: "bg-red-100 text-red-700",       badge: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-400" },
};

const NEXT_STATUS: Record<string, string | null> = {
  New: "Contacted",
  Contacted: "Qualified",
  Qualified: "ConvertedToBooking",
  ConvertedToBooking: null,
  Lost: null,
};

function LeadStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg?.badge ?? "bg-gray-100 text-gray-700"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
      {cfg?.label ?? status}
    </span>
  );
}

function KanbanCard({ lead, onMove, onDelete }: {
  lead: any;
  onMove: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const nextStatus = NEXT_STATUS[lead.lead_status];
  const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Link href={`/sales/leads/${lead.id}`}>
            <p className="text-sm font-semibold hover:text-primary truncate">{lead.first_name} {lead.last_name}</p>
          </Link>
          <p className="text-[10px] text-muted-foreground font-mono">{lead.lead_ref}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/sales/leads/${lead.id}`}>
            <button className="text-muted-foreground hover:text-foreground p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
          </Link>
          <button className="text-muted-foreground hover:text-red-500 p-0.5" onClick={() => onDelete(lead.id)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {lead.email && <p className="text-[10px] text-muted-foreground truncate mb-1">{lead.email}</p>}

      <div className="flex flex-wrap gap-1 mb-2">
        {lead.lead_source && (
          <span className="text-[9px] px-1.5 py-0.5 bg-muted rounded font-medium">{lead.lead_source}</span>
        )}
        {lead.preferred_space_type && (
          <span className="text-[9px] px-1.5 py-0.5 bg-muted rounded font-medium">{lead.preferred_space_type}</span>
        )}
      </div>

      {(lead.budget_min || lead.budget_max) && (
        <p className="text-[10px] text-muted-foreground mb-2">
          {t("lead.label_budget")}: {lead.budget_min != null ? formatMoney(lead.budget_min, lead.budget_currency ?? currency, currencyPosition) : "?"} – {lead.budget_max != null ? formatMoney(lead.budget_max, lead.budget_currency ?? currency, currencyPosition) : "?"}
        </p>
      )}

      {nextStatus && nextCfg && (
        <button
          className={`w-full flex items-center justify-center gap-1 text-[10px] font-medium py-1 px-2 rounded border ${nextCfg.badge} hover:opacity-80 transition-opacity mt-1`}
          onClick={() => onMove(lead.id, nextStatus)}
        >
          {t("lead.move_to", { stage: nextCfg.label })} <ArrowRight className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function KanbanView({ leads, onMove, onDelete }: {
  leads: any[];
  onMove: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const grouped = LEAD_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.lead_status === s);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {LEAD_STATUSES.map(status => {
        const cfg = STATUS_CONFIG[status]!;
        const items = grouped[status] ?? [];
        return (
          <div key={status} className={`flex-shrink-0 w-64 rounded-lg border ${cfg.bg} flex flex-col`}>
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${cfg.header}`}>
              <span className="text-xs font-semibold">{cfg.label}</span>
              <span className="text-[10px] font-bold bg-white/60 rounded-full px-1.5 py-0.5">{items.length}</span>
            </div>
            <div className={`flex-1 p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto`}>
              {items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">{t("lead.no_leads")}</p>
              ) : items.map(lead => (
                <KanbanCard key={lead.id} lead={lead} onMove={onMove} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeadList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = {
    search: search || undefined,
    lead_status: statusFilter || undefined,
    lead_source: sourceFilter || undefined,
  };
  const { data: leads, isLoading } = useListLeads(params, {
    query: { queryKey: getListLeadsQueryKey(params) },
  });

  const deleteMutation = useDeleteLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setDeleteId(null);
      },
    },
  });

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      },
    },
  });

  function handleMove(id: number, newStatus: string) {
    updateMutation.mutate({ id, data: { lead_status: newStatus } }, {
      onSuccess: () => toast({ title: t("lead.move_to", { stage: STATUS_CONFIG[newStatus]?.label ?? newStatus }) }),
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    });
  }

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "lead_ref",
        header: "lead.col_ref",
        cell: (l) => (
          <Link href={`/sales/leads/${l.id}`} className="font-mono text-xs font-medium hover:underline text-primary">{l.lead_ref}</Link>
        ),
      },
      {
        key: "name",
        header: "lead.col_name",
        hideable: false,
        sortAccessor: (l) => `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim(),
        cell: (l) => (
          <Link href={`/sales/leads/${l.id}`} className="font-medium hover:underline">
            {l.first_name} {l.last_name}
          </Link>
        ),
      },
      {
        key: "email",
        header: "lead.col_email",
        editable: { type: "text", getValue: (l) => l.email ?? "" },
        cell: (l) => <span className="text-muted-foreground">{l.email}</span>,
      },
      {
        key: "lead_source",
        header: "lead.col_source",
        editable: {
          type: "select",
          getValue: (l) => l.lead_source ?? "",
          options: ["Website", "Agent", "Referral", "WalkIn", "OTA", "Social", "Other"].map((s) => ({ value: s, label: s })),
        },
        cell: (l) => <span className="text-muted-foreground">{l.lead_source ?? "—"}</span>,
      },
      {
        key: "lead_status",
        header: "lead.col_status",
        editable: {
          type: "select",
          getValue: (l) => l.lead_status,
          options: LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s]?.label ?? s })),
        },
        cell: (l) => <LeadStatusBadge status={l.lead_status} />,
      },
      {
        key: "preferred_check_in_date",
        header: "booking.col_checkin",
        editable: { type: "date", getValue: (l) => l.preferred_check_in_date ?? "" },
        cell: (l) => <span className="text-muted-foreground">{formatDate(l.preferred_check_in_date)}</span>,
      },
      {
        key: "budget",
        header: "lead.col_budget",
        sortAccessor: (l) => Number(l.budget_min),
        cell: (l) => (
          <span className="text-muted-foreground">
            {l.budget_min || l.budget_max
              ? `${l.budget_min != null ? formatMoney(l.budget_min, l.budget_currency ?? currency, currencyPosition) : "?"} – ${l.budget_max != null ? formatMoney(l.budget_max, l.budget_currency ?? currency, currencyPosition) : "?"}`
              : "—"}
          </span>
        ),
      },
      {
        key: "next",
        header: "lead.col_next",
        sortable: false,
        cell: (l) => {
          const nextStatus = NEXT_STATUS[l.lead_status];
          const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;
          return nextStatus && nextCfg ? (
            <button
              className={`text-[10px] px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${nextCfg.badge} hover:opacity-80`}
              onClick={() => handleMove(l.id, nextStatus)}
            >
              {t("lead.move_to", { stage: nextCfg.label })}
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          );
        },
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 90,
        cell: (l) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/sales/leads/${l.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(l.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [t, handleMove, currency, currencyPosition],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.lead")}
        subtitle={`${leads?.length ?? 0} ${t("common.total")}`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <button
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setView("list")}
              >
                <LayoutList className="h-3.5 w-3.5" /> {t("lead.view_list")}
              </button>
              <button
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 border-l transition-colors ${view === "pipeline" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setView("pipeline")}
              >
                <Kanban className="h-3.5 w-3.5" /> {t("lead.view_kanban")}
              </button>
            </div>
            <Link href="/sales/leads/new">
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("lead.new")}</Button>
            </Link>
          </div>
        }
      />
      <div className="p-6">
        {view === "pipeline" ? (
          isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <KanbanView
              leads={leads ?? []}
              onMove={handleMove}
              onDelete={(id) => setDeleteId(id)}
            />
          )
        ) : (
          <DataTable
            tableKey="leads"
            columns={columns}
            data={leads ?? []}
            isLoading={isLoading}
            rowKey={(l) => l.id}
            emptyText={t("lead.no_leads")}
            editing={{ resource: "leads", onEdited: () => qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }) }}
            toolbarExtra={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder={t("lead.search_placeholder")} className="pl-8 h-8 text-sm" value={search}
                    onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
                  <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{t("lead.all_statuses")}</SelectItem>
                    {LEAD_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter || "__all"} onValueChange={(v) => setSourceFilter(v === "__all" ? "" : v)}>
                  <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder={t("common.source")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{t("common.all")} {t("common.source")}s</SelectItem>
                    {["Website", "Agent", "Referral", "WalkIn", "OTA", "Social", "Other"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lead.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.cannot_undo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
