import { useMemo, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

const FREQ_COLORS: Record<string, string> = {
  Weekly:   "bg-blue-100 text-blue-700",
  Biweekly: "bg-purple-100 text-purple-700",
  Monthly:  "bg-amber-100 text-amber-700",
};

const APPROVAL_COLORS: Record<string, string> = {
  PendingApproval: "bg-amber-100 text-amber-700",
  Approved:        "bg-green-100 text-green-700",
  Rejected:        "bg-red-100 text-red-700",
};

async function fetchSchedules(q?: string, activeFilter?: string, deleted?: boolean) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (activeFilter && activeFilter !== "_all") params.set("is_active", activeFilter);
  if (deleted) params.set("deleted", "only");
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

async function setApproval(id: number, action: "approve" | "reject") {
  const res = await apiFetch(`/api/v1/recurring-schedules/${id}/${action}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to update approval");
  return res.json();
}

function fmtDate(d: string | null) {
  return formatDate(d);
}

function isOverdue(nextDue: string | null) {
  if (!nextDue) return false;
  return new Date(nextDue) < new Date();
}

export default function RecurringScheduleList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [toggleTarget, setToggleTarget] = useState<{ id: number; is_active: boolean } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["recurring-schedules", q, activeFilter, showDeleted],
    queryFn: () => fetchSchedules(q || undefined, activeFilter, showDeleted),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleSchedule(id, is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
      setToggleTarget(null);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      setApproval(id, action),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["recurring-schedules"] });
      toast({
        title: variables.action === "approve"
          ? t("recurring.approved_toast")
          : t("recurring.rejected_toast"),
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
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

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "booking_ref",
        header: "recurring.col_booking",
        hideable: false,
        cell: (s) => (
          <Link href={`/booking/bookings/${s.booking_id}`}
            className="text-primary hover:underline font-mono text-xs font-semibold">
            {s.booking_ref ?? `#${s.booking_id}`}
          </Link>
        ),
      },
      {
        key: "account_name",
        header: "recurring.col_account",
        cell: (s) => <span className="text-sm">{s.account_name ?? "—"}</span>,
      },
      {
        key: "schedule_type",
        header: "recurring.col_type",
        cell: (s) => (
          <span className="text-xs text-muted-foreground">
            {t(`recurring.type_${s.schedule_type.toLowerCase()}`) || s.schedule_type}
          </span>
        ),
      },
      {
        key: "frequency",
        header: "recurring.col_frequency",
        cell: (s) => (
          <Badge className={`text-xs ${FREQ_COLORS[s.frequency] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`recurring.freq_${s.frequency.toLowerCase()}`) || s.frequency}
          </Badge>
        ),
      },
      {
        key: "amount",
        header: "recurring.col_amount",
        align: "right",
        sortAccessor: (s) => Number(s.amount),
        cell: (s) => (
          <span className="tabular-nums font-medium">
            {formatMoney(s.amount, s.currency ?? currency, currencyPosition)}
            {s.gst_included && <span className="text-xs text-muted-foreground ml-1">inc GST</span>}
          </span>
        ),
      },
      {
        key: "start_date",
        header: "recurring.col_start_date",
        cell: (s) => <span className="text-xs text-muted-foreground">{fmtDate(s.start_date)}</span>,
      },
      {
        key: "next_due_date",
        header: "recurring.col_next_due_date",
        cell: (s) => {
          const overdue = s.is_active && isOverdue(s.next_due_date);
          return (
            <div className="flex items-center gap-1.5">
              {overdue && <Calendar className="h-3.5 w-3.5 text-red-500 shrink-0" />}
              <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>
                {fmtDate(s.next_due_date)}
              </span>
            </div>
          );
        },
      },
      {
        key: "approval_status",
        header: "recurring.approval_status",
        cell: (s) => (
          <div className="flex flex-col items-start gap-1.5">
            <Badge className={`text-xs ${APPROVAL_COLORS[s.approval_status] ?? "bg-gray-100 text-gray-500"}`}>
              {s.approval_status === "PendingApproval"
                ? t("recurring.status_pending")
                : s.approval_status === "Approved"
                  ? t("recurring.status_approved")
                  : s.approval_status === "Rejected"
                    ? t("recurring.status_rejected")
                    : s.approval_status ?? "—"}
            </Badge>
            {s.approval_status === "PendingApproval" && (
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ id: s.id, action: "approve" })}
                >
                  {t("recurring.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs border-red-300 text-red-700 hover:bg-red-50"
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ id: s.id, action: "reject" })}
                >
                  {t("recurring.reject")}
                </Button>
              </div>
            )}
          </div>
        ),
      },
      {
        key: "is_active",
        header: "recurring.col_status",
        cell: (s) => (
          <Badge className={`text-xs ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {s.is_active ? t("common.active") : t("common.inactive")}
          </Badge>
        ),
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        cell: (s) => (
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
        ),
      },
    ],
    [t, approvalMutation.isPending, currency, currencyPosition],
  );

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
        <DataTable
          tableKey="recurring-schedules"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          rowKey={(s) => s.id}
          emptyText={t("recurring.no_schedules")}
          selection={{
            enable: true,
            resource: "recurring-schedules",
            onChanged: () => qc.invalidateQueries({ queryKey: ["recurring-schedules"] }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
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
          }
        />
      </div>

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
