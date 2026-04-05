import { useState } from "react";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListLeads, useDeleteLead, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LEAD_STATUS_COLORS: Record<string, string> = {
  New: "bg-gray-100 text-gray-700 border-gray-200",
  Contacted: "bg-blue-100 text-blue-700 border-blue-200",
  Qualified: "bg-amber-100 text-amber-700 border-amber-200",
  ConvertedToBooking: "bg-green-100 text-green-700 border-green-200",
  Lost: "bg-red-100 text-red-700 border-red-200",
};

function LeadStatusBadge({ status }: { status: string }) {
  const cls = LEAD_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  const label = status === "ConvertedToBooking" ? "Converted" : status;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function LeadList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();

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

  return (
    <Layout>
      <PageHeader
        title="Leads"
        subtitle={`${leads?.length ?? 0} total`}
        actions={
          <Link href="/sales/leads/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Lead</Button>
          </Link>
        }
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search leads…" className="pl-8 h-8 text-sm" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Contacted">Contacted</SelectItem>
              <SelectItem value="Qualified">Qualified</SelectItem>
              <SelectItem value="ConvertedToBooking">Converted</SelectItem>
              <SelectItem value="Lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter || "__all"} onValueChange={(v) => setSourceFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All sources</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Agent">Agent</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="WalkIn">Walk-In</SelectItem>
              <SelectItem value="OTA">OTA</SelectItem>
              <SelectItem value="Social">Social</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lead Ref</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Full Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Check-In</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Budget</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads?.map((l) => (
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
                      {l.budget_min || l.budget_max
                        ? `$${l.budget_min ?? "?"} – $${l.budget_max ?? "?"}`
                        : "—"}
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
                ))}
                {(!leads || leads.length === 0) && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No leads found</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
