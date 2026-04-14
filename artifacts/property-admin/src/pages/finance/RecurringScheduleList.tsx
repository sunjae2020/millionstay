import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, RefreshCw, ToggleLeft, ToggleRight, Calendar, Plus, Archive, X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/apiFetch";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const FREQ_COLORS: Record<string, string> = {
  Weekly:   "bg-blue-100 text-blue-700",
  Biweekly: "bg-purple-100 text-purple-700",
  Monthly:  "bg-amber-100 text-amber-700",
};

const TYPE_LABELS: Record<string, string> = {
  Rent:       "Rent",
  ServiceFee: "Service Fee",
  AdminFee:   "Admin Fee",
};

async function fetchSchedules(q?: string, activeFilter?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (activeFilter && activeFilter !== "_all") params.set("is_active", activeFilter);
  const res = await apiFetch(`/api/v1/recurring-schedules?${params}`);
  if (!res.ok) throw new Error("Failed to fetch schedules");
  return res.json();
}

async function toggleSchedule(id: number, is_active: boolean) {
  const res = await apiFetch(`/api/v1/recurring-schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify({ is_active }),
  });
  if (!res.ok) throw new Error("Failed to update");
  return res.json();
}

async function generateDueInvoices() {
  const res = await apiFetch("/api/v1/recurring-schedules/generate-due", { method: "POST" });
  if (!res.ok) throw new Error("Generation failed");
  return res.json();
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

function isOverdue(nextDue: string | null) {
  if (!nextDue) return false;
  return new Date(nextDue) < new Date();
}

export default function RecurringScheduleList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [toggleTarget, setToggleTarget] = useState<{ id: number; is_active: boolean } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"archive" | "permanent" | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["recurring-schedules", q, activeFilter],
    queryFn: () => fetchSchedules(q || undefined, activeFilter),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleSchedule(id, is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
      setToggleTarget(null);
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateDueInvoices();
      qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
      alert(`Generated ${result.generated ?? 0} invoice(s).`);
    } catch {
      alert("Invoice generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const rows: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const pagination = usePagination(rows);

  const pageIds = pagination.paginatedItems.map((s: any) => s.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id: number) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id: number) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id: number) => n.delete(id)); return n; });
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); pageIds.forEach((id: number) => n.add(id)); return n; });
    }
  };
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const handleBulkDelete = async (permanent: boolean) => {
    setIsBulkLoading(true);
    setBulkAction(null);
    try {
      const res = await apiFetch("/api/v1/recurring-schedules/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), permanent }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Bulk delete failed");
      qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
      toast({ title: permanent ? `${d.affected} schedules permanently deleted` : `${d.affected} schedules archived` });
      clearSelection();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t("nav.recurring")}
        subtitle={`${rows.length} ${t("nav.recurring")}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerate} disabled={generating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
              {generating ? t("common.loading") : t("recurring.generate_invoices") || "Run Due Invoices"}
            </Button>
            <Link href="/finance/invoices/new">
              <Button><Plus className="h-4 w-4 mr-2" />{t("invoice.new")}</Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("booking.search_placeholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("common.all")}</SelectItem>
              <SelectItem value="true">{t("common.active")}</SelectItem>
              <SelectItem value="false">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSuperAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200">
            <span className="text-sm font-medium text-orange-800">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button onClick={clearSelection} className="text-orange-500 hover:text-orange-700"><X className="h-3.5 w-3.5" /></button>
            <div className="ml-auto flex items-center gap-2">
              {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => setBulkAction("archive")} disabled={isBulkLoading}>
                <Archive className="h-3.5 w-3.5" /> Archive Selected
              </Button>
              <Button size="sm" variant="destructive" className="h-7 gap-1.5" onClick={() => setBulkAction("permanent")} disabled={isBulkLoading}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Forever
              </Button>
            </div>
          </div>
        )}
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {isSuperAdmin && <th className="px-3 py-3 w-8"><Checkbox checked={allPageSelected} data-state={somePageSelected && !allPageSelected ? "indeterminate" : allPageSelected ? "checked" : "unchecked"} onCheckedChange={toggleSelectAll} /></th>}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_booking")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_account")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_type")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_frequency")}</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_amount")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_start_date")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_next_due_date")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("recurring.col_status")}</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={isSuperAdmin ? 10 : 9} className="px-4 py-10 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 10 : 9} className="px-4 py-10 text-center text-muted-foreground">
                    {t("recurring.no_schedules")}
                  </td></tr>
                ) : pagination.paginatedItems.map((s: any) => {
                  const overdue = s.is_active && isOverdue(s.next_due_date);
                  return (
                    <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(s.id) ? "bg-orange-50/50" : ""}`}>
                      {isSuperAdmin && <td className="px-3 py-3"><Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></td>}
                      <td className="px-4 py-3">
                        <Link href={`/booking/bookings/${s.booking_id}`}
                          className="text-[#E8621A] hover:underline font-mono text-xs font-semibold">
                          {s.booking_ref ?? `#${s.booking_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">{s.account_name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {t(`recurring.type_${s.schedule_type.toLowerCase()}`) || s.schedule_type}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${FREQ_COLORS[s.frequency] ?? "bg-gray-100 text-gray-600"}`}>
                          {t(`recurring.freq_${s.frequency.toLowerCase()}`) || s.frequency}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        ${Number(s.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                        {s.gst_included && <span className="text-xs text-muted-foreground ml-1">inc GST</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.start_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {overdue && <Calendar className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>
                            {fmtDate(s.next_due_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.is_active ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setToggleTarget({ id: s.id, is_active: !s.is_active })}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          title={s.is_active ? t("common.pause") || "Pause" : t("common.resume") || "Resume"}
                        >
                          {s.is_active
                            ? <ToggleRight className="h-4 w-4 text-green-600" />
                            : <ToggleLeft className="h-4 w-4 text-gray-400" />
                          }
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>

      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {bulkAction === "permanent" ? "Permanently Delete Schedules" : "Archive Schedules"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "permanent"
                ? `You are about to permanently delete ${selectedIds.size} schedule(s). This cannot be undone.`
                : `You are about to archive ${selectedIds.size} schedule(s). They will be hidden from view.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant={bulkAction === "permanent" ? "destructive" : "outline"}
              className={bulkAction !== "permanent" ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
              onClick={() => handleBulkDelete(bulkAction === "permanent")}>
              {bulkAction === "permanent" ? "Delete Forever" : "Archive All"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={toggleTarget !== null} onOpenChange={() => setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.is_active ? t("finance.resume_schedule") || "Resume Schedule" : t("finance.pause_schedule") || "Pause Schedule"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? t("finance.resume_schedule_desc") || "This schedule will resume and invoices will be generated on the next due date."
                : t("finance.pause_schedule_desc") || "This schedule will be paused. No new invoices will be generated until resumed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
              className={toggleTarget?.is_active ? "bg-primary hover:bg-primary/90" : ""}
            >
              {toggleTarget?.is_active ? t("common.resume") || "Resume" : t("common.pause") || "Pause"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
