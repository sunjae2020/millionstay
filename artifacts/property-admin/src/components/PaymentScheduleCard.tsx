import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";

/**
 * 결제 일정 카드 — 계약이 "언제 얼마를 받기로 했고, 어디까지 들어왔는가".
 *
 * 계약 상세와 청구서 상세가 같은 카드를 쓴다. 회차 행이 있어야 청구서와 입금이
 * 각각 어느 회차의 것인지 가리킬 수 있으므로, 이 카드가 거래 원장
 * (/finance/transactions)과 청구서를 잇는 축이다.
 */

export type ScheduleKind =
  | "deposit" | "down_payment" | "interim_payment" | "balance" | "rent" | "advance"
  | "owner_rent" | "payout" | "other";

export interface PaymentScheduleRow {
  id: number;
  contract_id: number;
  /** 'ar' 받을 돈 / 'ap' 줄 돈. */
  direction: "ar" | "ap";
  counterparty_account_id: number | null;
  source_schedule_id: number | null;
  kind: ScheduleKind;
  seq: number;
  label: string | null;
  period: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  amount: number;
  currency: string;
  invoice_id: number | null;
  invoice_ref: string | null;
  invoice_status: string | null;
  paid_amount: number;
  outstanding: number;
  status: string;
  source: string;
  transaction_count: number;
  notes: string | null;
}

export const SCHEDULE_KINDS: ScheduleKind[] = [
  "deposit", "down_payment", "interim_payment", "balance", "rent", "advance", "other",
];
/** AP 회차에서 고를 수 있는 종류 — 받을 돈의 종류를 줄 돈에 쓰면 뜻이 안 맞는다. */
export const SCHEDULE_KINDS_AP: ScheduleKind[] = ["owner_rent", "payout", "other"];

const STATUS_CLASS: Record<string, string> = {
  pending:  "bg-gray-100 text-gray-600",
  invoiced: "bg-blue-100 text-blue-700",
  partial:  "bg-amber-100 text-amber-700",
  paid:     "bg-green-100 text-green-700",
  waived:   "bg-purple-100 text-purple-700",
};

/** 납기가 지났는데 완납이 아닌 회차 — 연체. 면제는 제외한다. */
export function isOverdue(row: PaymentScheduleRow): boolean {
  if (!row.due_date || row.status === "paid" || row.status === "waived") return false;
  return row.due_date < new Date().toISOString().slice(0, 10);
}

export function scheduleLabel(row: PaymentScheduleRow, t: (k: string) => string): string {
  if (row.label) return row.label;
  const base = t(`payment_schedule.kind_${row.kind}`);
  return row.period ? `${base} ${row.period}` : base;
}

export function usePaymentSchedule(contractId: number | null | undefined) {
  return useQuery<{
    data: PaymentScheduleRow[];
    meta: {
      total: number; paid: number; outstanding: number; count: number;
      ap_total: number; ap_paid: number; ap_outstanding: number;
    };
  }>({
    queryKey: ["payment-schedule", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      // ⚠️ `/v1/contracts/:id/payment-schedule` 은 정기 청구 스케줄
      // (recurring_schedules)이 이미 쓰는 경로다 — 결제 일정은 여기로 조회한다.
      const res = await apiFetch(`/api/v1/payment-schedules?contract_id=${contractId}`);
      if (!res.ok) throw new Error("Failed to load payment schedule");
      return res.json();
    },
  });
}

export function PaymentScheduleCard({
  contractId,
  currency,
  /** 청구서 상세에서 쓸 때: 그 청구서가 정산하는 회차만 강조한다. */
  highlightInvoiceId,
  readOnly = false,
}: {
  contractId: number;
  currency?: string;
  highlightInvoiceId?: number | null;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = useBrand();
  const [addOpen, setAddOpen] = useState(false);
  // 받을 돈과 줄 돈은 탭으로 가른다. 한 표에 섞으면 합계가 순액이 되어 어느 쪽도
  // 읽히지 않는다(미납 300만인지, 미지급 300만인지가 뒤섞인다).
  const [dir, setDir] = useState<"ar" | "ap">("ar");

  const { data, isLoading } = usePaymentSchedule(contractId);
  const allRows = data?.data ?? [];
  const rows = allRows.filter((r) => (r.direction ?? "ar") === dir);
  const apCount = allRows.filter((r) => r.direction === "ap").length;
  const meta = data?.meta;
  const cur = currency || rows[0]?.currency || brand.currency;
  const money = (n: number) => formatMoney(n, cur, brand.currencyPosition);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["payment-schedule", contractId] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const generate = useMutation({
    mutationFn: async (replace: boolean) => {
      const res = await apiFetch("/api/v1/payment-schedules/generate", {
        method: "POST",
        body: JSON.stringify({ contract_id: contractId, replace }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload as { created: number; skipped: number };
    },
    onSuccess: (r) => {
      invalidate();
      toast({ title: t("payment_schedule.generated", { created: r.created, skipped: r.skipped }) });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/payment-schedules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed");
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const waive = useMutation({
    mutationFn: async ({ id, waived }: { id: number; waived: boolean }) => {
      const res = await apiFetch(`/api/v1/payment-schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: waived ? "waived" : "pending" }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: invalidate,
  });

  const totals = useMemo(() => (dir === "ap"
    ? { total: meta?.ap_total ?? 0, paid: meta?.ap_paid ?? 0, outstanding: meta?.ap_outstanding ?? 0 }
    : { total: meta?.total ?? 0, paid: meta?.paid ?? 0, outstanding: meta?.outstanding ?? 0 }
  ), [meta, dir]);

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{t("payment_schedule.title")}</h3>
          <div className="flex rounded-md border overflow-hidden">
            {(["ar", "ap"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDir(d)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  dir === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t(`payment_schedule.dir_${d}`)}
                {d === "ap" && apCount > 0 ? ` (${apCount})` : ""}
              </button>
            ))}
          </div>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("payment_schedule.summary", {
                total: money(totals.total),
                paid: money(totals.paid),
                outstanding: money(totals.outstanding),
              })}
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => generate.mutate(false)} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              {t("payment_schedule.generate")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("payment_schedule.add_row")}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t(dir === "ap" ? "payment_schedule.empty_ap" : "payment_schedule.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b bg-muted/20">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_item")}</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_due")}</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_amount")}</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_paid")}</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_outstanding")}</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_invoice")}</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("payment_schedule.col_status")}</th>
                {!readOnly && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 ${
                    highlightInvoiceId && row.invoice_id === highlightInvoiceId ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-2 font-medium">{scheduleLabel(row, t)}</td>
                  <td className={`px-4 py-2 ${isOverdue(row) ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {formatDate(row.due_date) || "—"}
                    {isOverdue(row) && <span className="ml-1 text-xs">({t("payment_schedule.overdue")})</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(row.amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.paid_amount > 0 ? money(row.paid_amount) : "—"}
                    {row.transaction_count > 0 && (
                      <Link
                        href={`/finance/transactions?schedule=${row.id}`}
                        className="ml-1 text-xs text-primary hover:underline"
                      >
                        ({row.transaction_count})
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.outstanding > 0 ? money(row.outstanding) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {row.invoice_id ? (
                      <Link href={`/finance/invoices/${row.invoice_id}`} className="text-primary hover:underline">
                        {row.invoice_ref ?? `#${row.invoice_id}`}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[row.status] ?? STATUS_CLASS.pending}`}>
                      {t(`payment_schedule.status_${row.status}`)}
                    </span>
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-2 whitespace-nowrap text-right">
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => waive.mutate({ id: row.id, waived: row.status !== "waived" })}
                      >
                        {row.status === "waived" ? t("payment_schedule.unwaive") : t("payment_schedule.waive")}
                      </Button>
                      {row.paid_amount === 0 && (
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => remove.mutate(row.id)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddScheduleRowDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contractId={contractId}
        direction={dir}
        currency={cur}
        onSaved={invalidate}
      />
    </div>
  );
}

function AddScheduleRowDialog({
  open, onOpenChange, contractId, direction, currency, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: number;
  direction: "ar" | "ap";
  currency: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [kind, setKind] = useState<ScheduleKind>(direction === "ap" ? "owner_rent" : "other");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/payment-schedules", {
        method: "POST",
        body: JSON.stringify({
          contract_id: contractId,
          direction,
          kind,
          label: label || null,
          due_date: dueDate || null,
          period: kind === "rent" ? (period || null) : null,
          amount: Number(amount || 0),
          currency,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      setLabel(""); setAmount(""); setDueDate(""); setPeriod("");
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("payment_schedule.add_row")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("payment_schedule.col_item")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ScheduleKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(direction === "ap" ? SCHEDULE_KINDS_AP : SCHEDULE_KINDS).map((k) => (
                  <SelectItem key={k} value={k}>{t(`payment_schedule.kind_${k}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("payment_schedule.field_label")}</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("payment_schedule.field_label_hint")} />
          </div>
          {kind === "rent" && (
            <div>
              <Label className="text-xs">{t("payment_schedule.col_period")}</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-03" />
            </div>
          )}
          <div>
            <Label className="text-xs">{t("payment_schedule.col_due")}</Label>
            <DateInput value={dueDate} onChange={setDueDate} />
          </div>
          <div>
            <Label className="text-xs">{t("payment_schedule.col_amount")}</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !amount}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
