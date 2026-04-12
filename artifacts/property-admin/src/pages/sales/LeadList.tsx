import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListLeads, useUpdateLead, useDeleteLead, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, LayoutList, Kanban, GripVertical, ArrowRight } from "lucide-react";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const nextStatus = NEXT_STATUS[lead.lead_status];
  const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Link href={`/sales/leads/${lead.id}`}>
            <p className="text-sm font-semibold hover:text-[#E8621A] truncate">{lead.first_name} {lead.last_name}</p>
          </Link>
          <p className="text-[10px] text-muted-foreground font-mono">{lead.lead_ref}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/sales/leads/${lead.id}`}>
            <button className="text-muted-foreground hover:text-foreground p-0.5"><Pencil className="h-3 w-3" /></button>
          </Link>
          <button className="text-muted-foreground hover:text-red-500 p-0.5" onClick={() => onDelete(lead.id)}><Trash2 className="h-3 w-3" /></button>
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
          Budget: ${lead.budget_min ?? "?"} – ${lead.budget_max ?? "?"} {lead.budget_currency ?? "AUD"}
        </p>
      )}

      {nextStatus && nextCfg && (
        <button
          className={`w-full flex items-center justify-center gap-1 text-[10px] font-medium py-1 px-2 rounded border ${nextCfg.badge} hover:opacity-80 transition-opacity mt-1`}
          onClick={() => onMove(lead.id, nextStatus)}
        >
          Move to {nextCfg.label} <ArrowRight className="h-2.5 w-2.5" />
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
            <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">No leads</p>
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

  const pagination = usePagination(leads ?? []);

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
      onSuccess: () => toast({ title: `Lead moved to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}` }),
      onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
    });
  }

  return (
    <Layout>
      <PageHeader
        title={t("nav.lead")}
        subtitle={`${leads?.length ?? 0} total`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <button
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setView("list")}
              >
                <LayoutList className="h-3.5 w-3.5" /> List
              </button>
              <button
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 border-l transition-colors ${view === "pipeline" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setView("pipeline")}
              >
                <Kanban className="h-3.5 w-3.5" /> Pipeline
              </button>
            </div>
            <Link href="/sales/leads/new">
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Lead</Button>
            </Link>
          </div>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search leads…" className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          {view === "list" && (
            <>
              <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All statuses</SelectItem>
                  {LEAD_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter || "__all"} onValueChange={(v) => setSourceFilter(v === "__all" ? "" : v)}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All sources</SelectItem>
                  {["Website", "Agent", "Referral", "WalkIn", "OTA", "Social", "Other"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : view === "pipeline" ? (
          <KanbanView
            leads={leads ?? []}
            onMove={handleMove}
            onDelete={(id) => setDeleteId(id)}
          />
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lead Ref</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Full Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Check-In</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Budget</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Next Step</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagination.paginatedItems.map((l) => {
                      const nextStatus = NEXT_STATUS[l.lead_status];
                      const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;
                      return (
                        <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <Link href={`/sales/leads/${l.id}`} className="font-mono text-xs font-medium hover:underline text-primary">{l.lead_ref}</Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <Link href={`/sales/leads/${l.id}`} className="font-medium hover:underline">
                              {l.first_name} {l.last_name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.email}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.lead_source ?? "—"}</td>
                          <td className="px-4 py-2.5"><LeadStatusBadge status={l.lead_status} /></td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.preferred_check_in_date ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {l.budget_min || l.budget_max ? `$${l.budget_min ?? "?"} – $${l.budget_max ?? "?"}` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {nextStatus && nextCfg ? (
                              <button
                                className={`text-[10px] px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${nextCfg.badge} hover:opacity-80`}
                                onClick={() => handleMove(l.id, nextStatus)}
                              >
                                → {nextCfg.label}
                              </button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/sales/leads/${l.id}`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                              </Link>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(l.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!leads || leads.length === 0) && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No leads found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <TablePagination {...pagination} />
          </>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
