import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowRightLeft, ArrowUpRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight,
  Loader2, Plus, XCircle,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { LookupSelect } from "@/components/LookupSelect";
import { useDocumentRowActions } from "@/components/DocumentRowActions";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import EntityDocuments from "@/components/EntityDocuments";
import {
  scheduleLabel, usePaymentSchedule, type PaymentScheduleRow,
} from "@/components/PaymentScheduleCard";

/**
 * 거래 원장 (/finance/transactions).
 *
 * 인보이스가 "받을 돈", 원장(Journal)이 "회계 기록"이라면 여기는 **실제로 움직인
 * 돈**이다. 한 건을 입력할 때 계약의 결제 일정에서 회차를 고르면 그 회차의
 * 입금액·상태가 즉시 갱신되고, 청구서·계약 화면의 결제 일정 카드에 그대로
 * 반영된다. 그 연결이 이 화면의 존재 이유다.
 */

interface Transaction {
  id: number;
  txn_ref: string;
  txn_type: "income" | "expense" | "transfer";
  txn_date: string;
  amount: number;
  tax_amount: number;
  currency: string;
  contract_id: number | null;
  contract_ref: string | null;
  invoice_id: number | null;
  invoice_ref: string | null;
  payment_schedule_id: number | null;
  schedule_kind: string | null;
  schedule_label: string | null;
  schedule_period: string | null;
  account_id: number | null;
  account_name: string | null;
  contact_id: number | null;
  contact_name: string | null;
  counterparty_name: string | null;
  counterparty_display: string | null;
  bank_account_id: number | null;
  bank_account_name: string | null;
  counter_bank_account_id: number | null;
  payment_method: string | null;
  gl_account_code: string | null;
  gl_account_name: string | null;
  description: string | null;
  bank_reference: string | null;
  notes: string | null;
  status: string;
  journal_entry_id: number | null;
}

interface TxnListResponse {
  data: Transaction[];
  meta: { total: number; page: number; limit: number; pages: number; income: number; expense: number; net: number };
}

const TYPE_META: Record<string, { icon: typeof ArrowDownLeft; cls: string }> = {
  income:   { icon: ArrowDownLeft,  cls: "text-green-600" },
  expense:  { icon: ArrowUpRight,   cls: "text-red-600" },
  transfer: { icon: ArrowRightLeft, cls: "text-blue-600" },
};

const STATUS_CLASS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  confirmed: "bg-amber-100 text-amber-700",
  posted:    "bg-green-100 text-green-700",
  void:      "bg-red-50 text-red-500 line-through",
};

const emptyForm = {
  id: null as number | null,
  txn_type: "income" as Transaction["txn_type"],
  txn_date: new Date().toISOString().slice(0, 10),
  amount: "",
  tax_amount: "",
  currency: "",
  contract_id: null as number | null,
  contract_label: null as string | null,
  payment_schedule_id: null as number | null,
  invoice_id: null as number | null,
  account_id: null as number | null,
  account_label: null as string | null,
  counterparty_name: "",
  bank_account_id: null as number | null,
  counter_bank_account_id: null as number | null,
  gl_account_code: "",
  payment_method: "bank_transfer",
  description: "",
  bank_reference: "",
  notes: "",
  status: "confirmed" as string,
};
type FormState = typeof emptyForm;

export default function TransactionList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = useBrand();
  const search = useSearch();

  const [q, setQ] = useState("");
  const [type, setType] = useState("_all");
  const [status, setStatus] = useState("_all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // 결제 일정 카드에서 "입금 3건" 링크로 넘어오면 그 회차만 걸러 보여준다.
  const scheduleFilter = useMemo(() => {
    const id = Number(new URLSearchParams(search).get("schedule"));
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (type !== "_all") p.set("txn_type", type);
    if (status !== "_all") p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (scheduleFilter) p.set("payment_schedule_id", String(scheduleFilter));
    if (showDeleted) p.set("deleted", "only");
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [q, type, status, from, to, scheduleFilter, showDeleted, page, limit]);

  // 필터가 바뀌면 1페이지로 되돌린다 — 3페이지를 보던 중 필터를 좁히면 결과가
  // 한 페이지뿐인데 빈 화면이 나온다.
  useEffect(() => { setPage(1); }, [q, type, status, from, to, scheduleFilter, showDeleted, limit]);

  const { data, isLoading } = useQuery<TxnListResponse>({
    queryKey: ["transactions", params],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const money = (n: number, cur?: string) => formatMoney(n, cur || brand.currency, brand.currencyPosition);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["payment-schedule"] });
  };

  // 영수증은 공용 미리보기 모달로 연다(bare download 금지 — 문서 규약).
  // 거래 영수증에는 발송 엔드포인트가 없으므로 emailPath 는 주지 않는다.
  const { documentActionsColumn, documentPreview } = useDocumentRowActions<Transaction>((r) =>
    r.status === "confirmed" || r.status === "posted"
      ? {
          ref: r.invoice_ref ?? r.txn_ref,
          typeLabel: t("transaction.receipt"),
          pdfPath: `/api/v1/transactions/${r.id}/receipt/pdf`,
        }
      : null,
  );

  const action = useMutation({
    mutationFn: async ({ id, verb }: { id: number; verb: "confirm" | "post" | "void" }) => {
      const res = await apiFetch(`/api/v1/transactions/${id}/${verb}`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload;
    },
    onSuccess: (_r, v) => {
      invalidate();
      toast({ title: t(`transaction.toast_${v.verb}`) });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setForm({ ...emptyForm, currency: brand.currency });
    setDialogOpen(true);
  }

  function openEdit(txn: Transaction) {
    setForm({
      id: txn.id,
      txn_type: txn.txn_type,
      txn_date: txn.txn_date,
      amount: String(txn.amount),
      tax_amount: txn.tax_amount ? String(txn.tax_amount) : "",
      currency: txn.currency,
      contract_id: txn.contract_id,
      contract_label: txn.contract_ref,
      payment_schedule_id: txn.payment_schedule_id,
      invoice_id: txn.invoice_id,
      account_id: txn.account_id,
      account_label: txn.account_name,
      counterparty_name: txn.counterparty_name ?? "",
      bank_account_id: txn.bank_account_id,
      counter_bank_account_id: txn.counter_bank_account_id,
      gl_account_code: txn.gl_account_code ?? "",
      payment_method: txn.payment_method ?? "bank_transfer",
      description: txn.description ?? "",
      bank_reference: txn.bank_reference ?? "",
      notes: txn.notes ?? "",
      status: txn.status,
    });
    setDialogOpen(true);
  }

  const columns: ColumnDef<Transaction>[] = useMemo(() => [
    {
      key: "txn_ref",
      header: "transaction.col_ref",
      hideable: false,
      cell: (r) => {
        const Icon = TYPE_META[r.txn_type]?.icon ?? ArrowRightLeft;
        return (
          <button className="flex items-center gap-1.5 font-medium text-primary hover:underline" onClick={() => openEdit(r)}>
            <Icon className={`h-3.5 w-3.5 ${TYPE_META[r.txn_type]?.cls ?? ""}`} />
            {r.txn_ref}
          </button>
        );
      },
    },
    {
      key: "txn_date",
      header: "transaction.col_date",
      sortAccessor: (r) => r.txn_date,
      cell: (r) => <span className="text-muted-foreground">{formatDate(r.txn_date)}</span>,
    },
    {
      key: "txn_type",
      header: "transaction.col_type",
      cell: (r) => <span className={TYPE_META[r.txn_type]?.cls ?? ""}>{t(`transaction.type_${r.txn_type}`)}</span>,
    },
    {
      key: "counterparty_display",
      header: "transaction.col_counterparty",
      cell: (r) => <span>{r.counterparty_display ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "transaction.col_amount",
      align: "right",
      sortAccessor: (r) => r.amount,
      cell: (r) => (
        <span className={`font-medium tabular-nums ${TYPE_META[r.txn_type]?.cls ?? ""}`}>
          {r.txn_type === "expense" ? "−" : ""}{money(r.amount, r.currency)}
        </span>
      ),
    },
    {
      key: "schedule",
      header: "transaction.col_schedule",
      cell: (r) =>
        r.payment_schedule_id ? (
          <span className="text-xs">
            {r.schedule_label ?? t(`payment_schedule.kind_${r.schedule_kind ?? "other"}`)}
            {r.schedule_period ? ` ${r.schedule_period}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "contract_ref",
      header: "transaction.col_contract",
      cell: (r) =>
        r.contract_id ? (
          <Link href={`/contracts/${r.contract_id}`} className="text-primary hover:underline">{r.contract_ref}</Link>
        ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "invoice_ref",
      header: "transaction.col_invoice",
      cell: (r) =>
        r.invoice_id ? (
          <Link href={`/finance/invoices/${r.invoice_id}`} className="text-primary hover:underline">{r.invoice_ref}</Link>
        ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "bank_account_name",
      header: "transaction.col_bank_account",
      cell: (r) => <span className="text-muted-foreground">{r.bank_account_name ?? "—"}</span>,
    },
    {
      key: "gl_account_code",
      header: "transaction.col_gl_account",
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {r.gl_account_code ? `${r.gl_account_code} ${r.gl_account_name ?? ""}`.trim() : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "transaction.col_status",
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status] ?? STATUS_CLASS.draft}`}>
          {t(`transaction.status_${r.status}`)}
        </span>
      ),
    },
    documentActionsColumn,
    {
      key: ACTIONS_KEY,
      header: "common.actions",
      hideable: false,
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status === "draft" && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title={t("transaction.confirm")}
              onClick={() => action.mutate({ id: r.id, verb: "confirm" })}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("transaction.confirm")}
            </Button>
          )}
          {r.status !== "posted" && r.status !== "void" && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title={t("transaction.post")}
              onClick={() => action.mutate({ id: r.id, verb: "post" })}>
              <BookOpen className="h-3.5 w-3.5 mr-1" />{t("transaction.post")}
            </Button>
          )}
          {r.status !== "void" && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
              title={t("transaction.void")}
              onClick={() => action.mutate({ id: r.id, verb: "void" })}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ], [t, action, brand.currency, brand.currencyPosition, documentActionsColumn]);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.transaction")}</h1>
            <p className="text-sm text-muted-foreground">{t("transaction.subtitle")}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />{t("transaction.new")}
          </Button>
        </div>

        {/* 요약 — 확정·전기된 거래만 센다(초안과 취소는 빠진다). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <SummaryTile label={t("transaction.total_income")} value={money(meta?.income ?? 0)} cls="text-green-600" />
          <SummaryTile label={t("transaction.total_expense")} value={money(meta?.expense ?? 0)} cls="text-red-600" />
          <SummaryTile label={t("transaction.net")} value={money(meta?.net ?? 0)} cls="" />
        </div>

        {scheduleFilter && (
          <div className="mb-3 text-sm">
            <span className="px-2 py-1 rounded bg-primary/10 text-primary">
              {t("transaction.filtered_by_schedule")}
            </span>{" "}
            <Link href="/finance/transactions" className="text-primary hover:underline">{t("transaction.clear_filter")}</Link>
          </div>
        )}

        <DataTable
          tableKey="transactions"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          defaultPageSize={limit}
          rowKey={(r) => r.id}
          emptyText={t("transaction.empty")}
          selection={{ enable: true, resource: "transactions", onChanged: invalidate }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder={t("transaction.search_placeholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-56"
              />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("transaction.all_types")}</SelectItem>
                  <SelectItem value="income">{t("transaction.type_income")}</SelectItem>
                  <SelectItem value="expense">{t("transaction.type_expense")}</SelectItem>
                  <SelectItem value="transfer">{t("transaction.type_transfer")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("transaction.all_statuses")}</SelectItem>
                  <SelectItem value="draft">{t("transaction.status_draft")}</SelectItem>
                  <SelectItem value="confirmed">{t("transaction.status_confirmed")}</SelectItem>
                  <SelectItem value="posted">{t("transaction.status_posted")}</SelectItem>
                  <SelectItem value="void">{t("transaction.status_void")}</SelectItem>
                </SelectContent>
              </Select>
              <DateInput value={from} onChange={setFrom} className="w-40" />
              <DateInput value={to} onChange={setTo} className="w-40" min={from || undefined} />

              {/* 서버 페이지 이동. DataTable 자체 페이징은 defaultPageSize={limit} 로
                  한 페이지에 다 담아, 두 겹으로 나뉘어 보이지 않게 한다. */}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("transaction.page_of", { page: meta?.page ?? 1, pages: meta?.pages ?? 1, total: meta?.total ?? 0 })}
                </span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={(meta?.page ?? 1) <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={(meta?.page ?? 1) >= (meta?.pages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[50, 100, 200, 500].map((n) => (
                      <SelectItem key={n} value={String(n)}>{t("transaction.per_page", { n })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
        />
      </div>

      {documentPreview}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        onSaved={invalidate}
      />
    </Layout>
  );
}

function SummaryTile({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="border rounded-lg bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

// ── 입력 팝업 ────────────────────────────────────────────────────────────────
// 계약을 고르면 그 계약의 결제 일정이 따라오고, 회차를 고르면 금액·청구서가
// 채워진다. "3월 월세 얼마 들어옴"을 한 화면에서 끝내기 위한 순서다.
function TransactionDialog({
  open, onOpenChange, form, setForm, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormState;
  setForm: (f: FormState) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const brand = useBrand();

  const { data: scheduleResp } = usePaymentSchedule(form.contract_id);
  // 거래 방향에 맞는 회차만 보여준다. 수입은 받을 돈(AR), 지출은 줄 돈(AP)을
  // 정산한다 — 반대쪽을 고를 수 있게 두면 미납이 줄어든 것처럼 보이는 오류가
  // 정산 단계까지 드러나지 않는다(서버도 같은 규칙으로 한 번 더 막는다).
  const wantDir = form.txn_type === "expense" ? "ap" : "ar";
  const scheduleRows: PaymentScheduleRow[] = (scheduleResp?.data ?? [])
    .filter((r) => (r.direction ?? "ar") === wantDir);

  const { data: bankAccounts } = useQuery<{ data: { id: number; name: string; currency: string }[] }>({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/bank-accounts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: glAccounts } = useQuery<{ data: { code: string; name: string; account_type: string }[] }>({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/chart-of-accounts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // 계약이 바뀌면 이전 계약의 회차를 그대로 들고 있지 않도록 끊는다.
  useEffect(() => {
    if (!form.payment_schedule_id) return;
    if (!scheduleRows.some((r) => r.id === form.payment_schedule_id)) {
      setForm({ ...form, payment_schedule_id: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.contract_id, form.txn_type, scheduleRows.length]);

  function pickSchedule(id: string) {
    if (id === "_none") {
      setForm({ ...form, payment_schedule_id: null });
      return;
    }
    const row = scheduleRows.find((r) => r.id === Number(id));
    if (!row) return;
    setForm({
      ...form,
      payment_schedule_id: row.id,
      invoice_id: row.invoice_id ?? form.invoice_id,
      currency: row.currency || form.currency,
      // 미납 잔액을 기본값으로 넣는다 — 대부분의 입금은 남은 금액 전액이다.
      amount: form.amount || String(row.outstanding || row.amount),
      description: form.description || scheduleLabel(row, t),
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        txn_type: form.txn_type,
        txn_date: form.txn_date,
        amount: Number(form.amount || 0),
        tax_amount: form.tax_amount ? Number(form.tax_amount) : 0,
        currency: form.currency || brand.currency,
        contract_id: form.contract_id,
        invoice_id: form.invoice_id,
        payment_schedule_id: form.payment_schedule_id,
        account_id: form.account_id,
        counterparty_name: form.counterparty_name || null,
        bank_account_id: form.bank_account_id,
        counter_bank_account_id: form.txn_type === "transfer" ? form.counter_bank_account_id : null,
        gl_account_code: form.gl_account_code || null,
        payment_method: form.payment_method || null,
        description: form.description || null,
        bank_reference: form.bank_reference || null,
        notes: form.notes || null,
        status: form.status,
      };
      const res = await apiFetch(
        form.id ? `/api/v1/transactions/${form.id}` : "/api/v1/transactions",
        { method: form.id ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      toast({ title: t("common.saved") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const selectedSchedule = scheduleRows.find((r) => r.id === form.payment_schedule_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? t("transaction.edit") : t("transaction.new")}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{t("transaction.col_type")}</Label>
            <Select value={form.txn_type} onValueChange={(v) => setForm({ ...form, txn_type: v as FormState["txn_type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t("transaction.type_income")}</SelectItem>
                <SelectItem value="expense">{t("transaction.type_expense")}</SelectItem>
                <SelectItem value="transfer">{t("transaction.type_transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("transaction.col_date")}</Label>
            <DateInput value={form.txn_date} onChange={(v) => setForm({ ...form, txn_date: v })} />
          </div>

          <div>
            <Label className="text-xs">{t("transaction.col_amount")}</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">{t("transaction.field_currency")}</Label>
            <Select value={form.currency || brand.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── 결제 일정 연결 ─────────────────────────────────────────────── */}
          <div className="sm:col-span-2 border rounded-md p-3 bg-muted/20 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">{t("transaction.section_link")}</div>
            <div>
              <Label className="text-xs">{t("transaction.col_contract")}</Label>
              <LookupSelect
                value={form.contract_id}
                displayValue={form.contract_label}
                onChange={(id) => setForm({ ...form, contract_id: id, payment_schedule_id: null })}
                lookupUrl="/api/v1/lookup/contracts"
                placeholder={t("transaction.search_contract")}
              />
            </div>
            <div>
              <Label className="text-xs">{t("transaction.col_schedule")}</Label>
              <Select
                value={form.payment_schedule_id ? String(form.payment_schedule_id) : "_none"}
                onValueChange={pickSchedule}
                disabled={!form.contract_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("transaction.pick_schedule")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("transaction.no_schedule")}</SelectItem>
                  {scheduleRows.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {scheduleLabel(r, t)} · {formatMoney(r.amount, r.currency, brand.currencyPosition)}
                      {r.outstanding > 0 ? ` · ${t("payment_schedule.col_outstanding")} ${formatMoney(r.outstanding, r.currency, brand.currencyPosition)}` : ` · ${t("payment_schedule.status_paid")}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.contract_id && (
                <p className="text-xs text-muted-foreground mt-1">{t("transaction.pick_contract_first")}</p>
              )}
              {form.contract_id && scheduleRows.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t(wantDir === "ap" ? "transaction.no_ap_lines" : "transaction.no_ar_lines")}
                </p>
              )}
              {selectedSchedule && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("payment_schedule.col_due")}: {formatDate(selectedSchedule.due_date) || "—"}
                  {selectedSchedule.invoice_ref ? ` · ${selectedSchedule.invoice_ref}` : ""}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">{t("transaction.col_counterparty")}</Label>
            <LookupSelect
              value={form.account_id}
              displayValue={form.account_label}
              onChange={(id) => setForm({ ...form, account_id: id })}
              lookupUrl="/api/v1/lookup/accounts"
              placeholder={t("transaction.search_account")}
            />
          </div>
          <div>
            <Label className="text-xs">{t("transaction.field_counterparty_name")}</Label>
            <Input
              value={form.counterparty_name}
              onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })}
              placeholder={t("transaction.field_counterparty_name_hint")}
            />
          </div>

          <div>
            <Label className="text-xs">{t("transaction.col_bank_account")}</Label>
            <Select
              value={form.bank_account_id ? String(form.bank_account_id) : "_none"}
              onValueChange={(v) => setForm({ ...form, bank_account_id: v === "_none" ? null : Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t("common.none")}</SelectItem>
                {(bankAccounts?.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.txn_type === "transfer" ? (
            <div>
              <Label className="text-xs">{t("transaction.field_counter_bank")}</Label>
              <Select
                value={form.counter_bank_account_id ? String(form.counter_bank_account_id) : "_none"}
                onValueChange={(v) => setForm({ ...form, counter_bank_account_id: v === "_none" ? null : Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("common.none")}</SelectItem>
                  {(bankAccounts?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">{t("transaction.col_gl_account")}</Label>
              <Select
                value={form.gl_account_code || "_none"}
                onValueChange={(v) => setForm({ ...form, gl_account_code: v === "_none" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("transaction.gl_auto")}</SelectItem>
                  {(glAccounts?.data ?? []).map((a) => (
                    <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">{t("transaction.field_tax")}</Label>
            <Input type="number" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">{t("transaction.field_bank_reference")}</Label>
            <Input value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} />
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs">{t("transaction.field_description")}</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">{t("transaction.field_notes")}</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">{t("transaction.col_status")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("transaction.status_draft")}</SelectItem>
                <SelectItem value="confirmed">{t("transaction.status_confirmed")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t("transaction.status_hint")}</p>
          </div>
        </div>

        {/* 영수증·증빙 — 저장된 거래에만 붙는다(첨부는 거래 id 를 필요로 한다).
            폰에서는 EntityDocuments 의 촬영 버튼으로 종이 영수증을 바로 찍는다. */}
        {form.id ? (
          <div className="mt-4 border-t pt-4">
            <EntityDocuments entityType="transaction" entityId={form.id} defaultDocType="receipt" />
          </div>
        ) : (
          <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">
            {t("transaction.receipt_after_save", "Save the transaction first, then attach its receipt.")}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.amount}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
