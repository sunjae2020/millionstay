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
import { Search, RefreshCw, ToggleLeft, ToggleRight, Calendar, Plus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
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
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [toggleTarget, setToggleTarget] = useState<{ id: number; is_active: boolean } | null>(null);
  const [generating, setGenerating] = useState(false);
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

  return (
    <Layout>
      <PageHeader
        title={t("nav.recurring")}
        subtitle={`${rows.length} schedule${rows.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerate} disabled={generating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Generating…" : "Run Due Invoices"}
            </Button>
            <Link href="/finance/invoices/new">
              <Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by booking ref…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Booking</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Frequency</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Next Due</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    No recurring schedules found. Create one from a Booking or Invoice.
                  </td></tr>
                ) : pagination.paginatedItems.map((s: any) => {
                  const overdue = s.is_active && isOverdue(s.next_due_date);
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/booking/bookings/${s.booking_id}`}
                          className="text-[#E8621A] hover:underline font-mono text-xs font-semibold">
                          {s.booking_ref ?? `#${s.booking_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">{s.account_name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {TYPE_LABELS[s.schedule_type] ?? s.schedule_type}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${FREQ_COLORS[s.frequency] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.frequency}
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
                          {s.is_active ? "Active" : "Paused"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setToggleTarget({ id: s.id, is_active: !s.is_active })}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          title={s.is_active ? "Pause schedule" : "Resume schedule"}
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

      <AlertDialog open={toggleTarget !== null} onOpenChange={() => setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.is_active ? "Resume Schedule" : "Pause Schedule"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? "This schedule will resume and invoices will be generated on the next due date."
                : "This schedule will be paused. No new invoices will be generated until resumed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
              className={toggleTarget?.is_active ? "bg-primary hover:bg-primary/90" : ""}
            >
              {toggleTarget?.is_active ? "Resume" : "Pause"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
