import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowRightLeft, ArrowUpRight, BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, CornerDownRight, FileUp, Landmark, Loader2, Plus, ScanLine, Split, XCircle,
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
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { LookupSelect } from "@/components/LookupSelect";
import { useDocumentRowActions } from "@/components/DocumentRowActions";
import { BankStatementImportDialog } from "@/components/BankStatementImportDialog";
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
  workflow_status: string;
  split_leg_count: number;
  split_role: string | null;
  parent_transaction_id: number | null;
  base_amount: number | null;
}

/** 서버가 정렬할 수 있는 컬럼(api-server routes/transactions.ts 의 TRANSACTION_SORT 와 1:1). */
const SORTABLE_KEYS = [
  "txn_ref", "txn_date", "txn_type", "counterparty_display", "amount",
  "contract_ref", "invoice_ref", "bank_account_name", "gl_account_code", "status",
  "created_at", "updated_at",
];

interface TxnListResponse {
  data: Transaction[];
  meta: { total: number; page: number; limit: number; pages: number; income: number; expense: number; net: number };
}

const TYPE_META: Record<string, { icon: typeof ArrowDownLeft; cls: string }> = {
  income:   { icon: ArrowDownLeft,  cls: "text-green-600" },
  expense:  { icon: ArrowUpRight,   cls: "text-red-600" },
  transfer: { icon: ArrowRightLeft, cls: "text-blue-600" },
};

const WF_CLASS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  submitted: "bg-amber-100 text-amber-700",
  posted:    "bg-blue-100 text-blue-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  paid:      "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  void:      "bg-gray-100 text-gray-400 line-through",
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
  // 은행 원장 — 통장 스코프와 버킷. 통장을 훑는 사람의 질문은 "아직 손 안 댄 게
  // 뭐냐" 하나라, 그 답이 탭 배지로 먼저 보여야 한다.
  const [bankAccount, setBankAccount] = useState("_all");
  const [bucket, setBucket] = useState("_all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // ── 분할 legs ─────────────────────────────────────────────────────────────
  // 원본 아래에 자식을 **끼워 넣어** 보여준다. 목록은 기본적으로 자식을 접으므로
  // (서버가 parent 가 있는 행을 걸러 준다) 펼칠 때만 따로 받아 온다.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [legs, setLegs] = useState<Record<number, Transaction[]>>({});
  const [legsLoading, setLegsLoading] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<FormState>(emptyForm);

  // 결제 일정 카드에서 "입금 3건" 링크로 넘어오면 그 회차만 걸러 보여준다.
  const scheduleFilter = useMemo(() => {
    const id = Number(new URLSearchParams(search).get("schedule"));
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [search]);

  const filters = {
    q: q || undefined,
    txn_type: type !== "_all" ? type : undefined,
    status: status !== "_all" ? status : undefined,
    from: from || undefined,
    to: to || undefined,
    payment_schedule_id: scheduleFilter ?? undefined,
    bank_account_id: bankAccount !== "_all" ? bankAccount : undefined,
    bucket: bucket !== "_all" ? bucket : undefined,
    deleted: showDeleted ? "only" : undefined,
  };

  // 페이지 이동·정렬·건수는 DataTable 이 server prop 으로 직접 다룬다(예전의
  // 별도 페이지 버튼 + defaultPageSize 이중 페이징을 대체).
  const { rows, isLoading, server, meta: rawMeta, invalidate: invalidateList } =
    useServerList<Transaction>("/api/v1/transactions", {
      filters,
      sortableKeys: SORTABLE_KEYS,
      defaultSort: { key: "txn_date", dir: "desc" },
      defaultPageSize: 100,
    });

  // 인라인 계정과목 셀렉트의 선택지. 은행 임포트 직후 분류 작업에서 가장 많이 쓴다.
  const { data: coa } = useQuery<{ data: Array<{ code: string; name: string }> }>({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/chart-of-accounts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: bankSummary } = useQuery<{
    data: Array<{
      id: number; name: string; currency: string; review_count: number; categorised_count: number;
      excluded_count: number; net_movement: number; gl_balance: number;
      statement_balance: number | null; difference: number | null; gl_shared: boolean;
    }>;
    unassigned: { review_count: number; categorised_count: number; excluded_count: number };
  }>({
    queryKey: ["transactions-bank-summary"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/transactions/bank-summary");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const activeBank = bankAccount !== "_all" && bankAccount !== "unassigned"
    ? bankSummary?.data.find((b) => String(b.id) === bankAccount)
    : undefined;

  // 탭 배지 건수 — 통장을 고르면 그 통장 것만, 아니면 전 계좌 합.
  const bucketCounts = useMemo(() => {
    const rowsOf = bankAccount === "unassigned"
      ? (bankSummary ? [bankSummary.unassigned] : [])
      : activeBank ? [activeBank] : (bankSummary?.data ?? []);
    const sum = (k: "review_count" | "categorised_count" | "excluded_count") =>
      rowsOf.reduce((n, r) => n + ((r as Record<string, number>)[k] ?? 0), 0);
    return { review: sum("review_count"), categorised: sum("categorised_count"), excluded: sum("excluded_count") };
  }, [bankSummary, activeBank, bankAccount]);

  // 합계 타일은 서버가 **필터 전체** 기준으로 계산해 meta 로 실어 보낸다.
  const meta = rawMeta as TxnListResponse["meta"] | undefined;
  const money = (n: number, cur?: string) => formatMoney(n, cur || brand.currency, brand.currencyPosition);

  const invalidate = () => {
    invalidateList();
    qc.invalidateQueries({ queryKey: ["transactions-bank-summary"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["payment-schedule"] });
  };

  async function toggleLegs(id: number) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    if (legs[id] || legsLoading.has(id)) return;
    setLegsLoading((p) => new Set(p).add(id));
    try {
      const res = await apiFetch(`/api/v1/transactions/${id}/split-children`);
      const payload = await res.json().catch(() => ({}));
      if (res.ok) setLegs((m) => ({ ...m, [id]: payload.data ?? [] }));
    } finally {
      setLegsLoading((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  const splitSources = useMemo(() => rows.filter((r) => (r.split_leg_count ?? 0) > 0), [rows]);
  const allExpanded = splitSources.length > 0 && splitSources.every((r) => expanded.has(r.id));

  function toggleAll() {
    if (allExpanded) { setExpanded(new Set()); return; }
    splitSources.forEach((r) => { if (!legs[r.id]) void toggleLegs(r.id); });
    setExpanded(new Set(splitSources.map((r) => r.id)));
  }

  // 펼친 원본 바로 아래에 자식을 끼운다. DataTable 은 서버 모드에서 data 를 그대로
  // 순회하므로, 배열만 조립하면 중첩 행이 그려진다(공용 컴포넌트를 건드리지 않는다).
  const displayRows = useMemo(() => {
    const out: Transaction[] = [];
    for (const r of rows) {
      out.push(r);
      if (expanded.has(r.id)) out.push(...(legs[r.id] ?? []));
    }
    return out;
  }, [rows, expanded, legs]);

  const isLeg = (r: Transaction) => r.parent_transaction_id != null;

  /**
   * 인라인으로 고칠 수 있는 행인가.
   *
   * 전기(posted)된 거래의 금액·날짜는 서버가 이미 거부한다(원장과 어긋나므로
   * 취소 후 재입력이 유일한 정정 경로). 취소된 건과 분할 자식도 목록에서
   * 직접 고치지 않는다 — 자식은 원본과 함께 다뤄야 한다.
   */
  const editableRow = (r: Transaction) =>
    r.status !== "void" && !isLeg(r);
  /** 금액·날짜는 전기 전에만. */
  const editableAmount = (r: Transaction) => editableRow(r) && r.status !== "posted";


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
        const leg = isLeg(r);
        return (
          <div className={`flex items-center gap-1.5 ${leg ? "pl-5" : ""}`}>
            {leg ? (
              // 자식 leg — 원본에서 갈라져 나온 돈이라는 것이 한눈에 보여야 한다.
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 shrink-0">
                <CornerDownRight className="h-3 w-3" />
                {t(`transaction.leg_${r.split_role ?? "disbursement"}`)}
              </span>
            ) : (
              <Icon className={`h-3.5 w-3.5 shrink-0 ${TYPE_META[r.txn_type]?.cls ?? ""}`} />
            )}
            <Link href={`/finance/transactions/${r.id}`} className="font-medium text-primary hover:underline">
              {r.txn_ref}
            </Link>
            {(r.split_leg_count ?? 0) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); void toggleLegs(r.id); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 shrink-0"
                title={t("transaction.split_source_hint")}
              >
                {legsLoading.has(r.id)
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : expanded.has(r.id) ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                <Split className="h-2.5 w-2.5" />
                {t("transaction.split_legs_count", { count: r.split_leg_count })}
              </button>
            )}
            {!leg && (
              <button className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => openEdit(r)} title={t("transaction.edit")}>✎</button>
            )}
          </div>
        );
      },
    },
    {
      key: "txn_date",
      header: "transaction.col_date",
      sortAccessor: (r) => r.txn_date,
      editable: { type: "date", getValue: (r) => r.txn_date, canEdit: editableAmount },
      cell: (r) => <span className="text-muted-foreground">{formatDate(r.txn_date)}</span>,
    },
    {
      key: "txn_type",
      header: "transaction.col_type",
      cell: (r) => {
        const Icon = TYPE_META[r.txn_type]?.icon ?? ArrowRightLeft;
        return (
          <span className={`inline-flex items-center gap-1 ${TYPE_META[r.txn_type]?.cls ?? ""}`}>
            <Icon className="h-3 w-3" />{t(`transaction.type_${r.txn_type}`)}
          </span>
        );
      },
    },
    {
      key: "counterparty_display",
      header: "transaction.col_counterparty",
      // 계정이 연결된 행은 이름을 여기서 바꾸면 계정과 어긋나므로, 자유 입력
      // 거래처(counterparty_name)만 고칠 수 있게 둔다.
      editable: {
        type: "text", field: "counterparty_name",
        getValue: (r) => r.counterparty_name ?? "",
        canEdit: (r) => editableRow(r) && r.account_id == null,
      },
      cell: (r) => <span>{r.counterparty_display ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "transaction.col_amount",
      align: "right",
      sortAccessor: (r) => r.amount,
      editable: { type: "number", getValue: (r) => r.amount, canEdit: editableAmount, min: 0 },
      cell: (r) => (
        <span className={`font-medium tabular-nums ${TYPE_META[r.txn_type]?.cls ?? ""}`}>
          {r.txn_type === "expense" ? "−" : r.txn_type === "income" ? "+" : ""}
          {money(r.amount, r.currency)}
          {/* 통화가 섞인 원장에서 합계를 읽으려면 기준통화 환산액이 함께 보여야 한다. */}
          {r.base_amount != null && r.currency !== brand.currency && (
            <span className="block text-[10px] font-normal text-muted-foreground">
              ≈ {money(r.base_amount, brand.currency)}
            </span>
          )}
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
      // 계정과목은 목록에서 가장 자주 고치는 값이다(은행 임포트 직후 분류 작업).
      editable: {
        type: "select",
        getValue: (r) => r.gl_account_code ?? "",
        canEdit: editableRow,
        options: [
          { value: "", label: t("transaction.gl_auto") },
          ...(coa?.data ?? []).map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` })),
        ],
      },
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {r.gl_account_code ? `${r.gl_account_code} ${r.gl_account_name ?? ""}`.trim() : "—"}
        </span>
      ),
    },
    {
      key: "workflow_status",
      header: "transaction.col_approval",
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${WF_CLASS[r.workflow_status ?? "draft"] ?? WF_CLASS.draft}`}>
          {t(`transaction.wf_${r.workflow_status ?? "draft"}`)}
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
  ], [t, action, brand.currency, brand.currencyPosition, documentActionsColumn, expanded, legs, legsLoading, coa]);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.transaction")}</h1>
            <p className="text-sm text-muted-foreground">{t("transaction.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 통장 명세서를 통째로 가져오는 경로. 한 건씩 입력하는 것보다 이쪽이
                실제 업무의 기본 동선이라 신규 등록 옆에 나란히 둔다. */}
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4 mr-1" />{t("transaction.import_statement")}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />{t("transaction.new")}
            </Button>
          </div>
        </div>

        {/* 요약 — 확정·전기된 거래만 센다(초안과 취소는 빠진다). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <SummaryTile label={t("transaction.total_income")} value={money(meta?.income ?? 0)} cls="text-green-600" />
          <SummaryTile label={t("transaction.total_expense")} value={money(meta?.expense ?? 0)} cls="text-red-600" />
          <SummaryTile label={t("transaction.net")} value={money(meta?.net ?? 0)} cls="" />
        </div>

        {/* ── 은행 원장 ─────────────────────────────────────────────────────
            통장을 고르고, 버킷 탭으로 "아직 손 안 댄 것"부터 좁힌다. 잔액 대사는
            명세서 잔액이 등록된 통장에서만 뜻이 있으므로 없으면 아예 안 보여준다
            — 0으로 두면 맞는 것처럼 읽힌다. */}
        <div className="border rounded-lg bg-card px-4 py-3 mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{t("transaction.bank_ledger")}</span>
            <Select value={bankAccount} onValueChange={setBankAccount}>
              <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("transaction.all_bank_accounts")}</SelectItem>
                {(bankSummary?.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
                <SelectItem value="unassigned">{t("transaction.bank_unassigned")}</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-md border overflow-hidden">
              {([
                { key: "_all", label: t("transaction.bucket_all"), n: null },
                { key: "review", label: t("transaction.bucket_review"), n: bucketCounts.review },
                { key: "categorised", label: t("transaction.bucket_categorised"), n: bucketCounts.categorised },
                { key: "excluded", label: t("transaction.bucket_excluded"), n: bucketCounts.excluded },
              ] as const).map((b) => (
                <button
                  key={b.key}
                  onClick={() => setBucket(b.key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    bucket === b.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {b.label}{b.n != null && b.n > 0 ? ` (${b.n})` : ""}
                </button>
              ))}
            </div>
          </div>

          {activeBank && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                {t("transaction.bank_net")}{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {money(activeBank.net_movement, activeBank.currency)}
                </span>
              </span>
              <span className="text-muted-foreground">
                {t("transaction.bank_gl_balance")}{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {money(activeBank.gl_balance, activeBank.currency)}
                </span>
              </span>
              {activeBank.gl_shared ? (
                // 계정과목을 여러 통장이 공유하면 잔액 대사가 성립하지 않는다.
                <span className="text-amber-600">{t("transaction.bank_gl_shared")}</span>
              ) : activeBank.statement_balance != null ? (
                <>
                  <span className="text-muted-foreground">
                    {t("transaction.bank_statement_balance")}{" "}
                    <span className="tabular-nums font-medium text-foreground">
                      {money(activeBank.statement_balance, activeBank.currency)}
                    </span>
                  </span>
                  <span className={Math.abs(activeBank.difference ?? 0) < 0.01 ? "text-green-600" : "text-red-600 font-medium"}>
                    {Math.abs(activeBank.difference ?? 0) < 0.01
                      ? t("transaction.bank_reconciled")
                      : t("transaction.bank_difference", { amount: money(activeBank.difference ?? 0, activeBank.currency) })}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{t("transaction.bank_no_statement")}</span>
              )}
            </div>
          )}
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
          data={displayRows}
          isLoading={isLoading}
          server={server}
          rowKey={(r) => r.id}
          emptyText={t("transaction.empty")}
          selection={{ enable: true, resource: "transactions", onChanged: invalidate }}
          editing={{ resource: "transactions", onEdited: invalidate }}
          // 인라인으로 못 고치는 칸을 누르면 상세로 간다.
          detailHref={(r) => `/finance/transactions/${r.id}`}
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
              {splitSources.length > 0 && (
                <Button variant="outline" size="sm" className="h-8" onClick={toggleAll}>
                  {allExpanded
                    ? <><ChevronsDownUp className="h-3.5 w-3.5 mr-1" />{t("transaction.split_collapse_all")}</>
                    : <><ChevronsUpDown className="h-3.5 w-3.5 mr-1" />{t("transaction.split_expand_all")}</>}
                </Button>
              )}
              <DateInput value={from} onChange={setFrom} className="w-40" />
              <DateInput value={to} onChange={setTo} className="w-40" min={from || undefined} />

            </div>
          }
        />
      </div>

      {documentPreview}

      <BankStatementImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={invalidate}
      />

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

  // ── 영수증 판독 ───────────────────────────────────────────────────────────
  // 읽은 값은 **비어 있는 칸에만** 채운다. 사람이 이미 입력한 것을 모델이 덮으면
  // 무엇이 내 입력이고 무엇이 판독인지 알 수 없어진다. 확신 없는 칸은 서버가
  // null 로 내려주므로 그대로 비워 둔다.
  const ocrRef = useRef<HTMLInputElement>(null);
  const ocr = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/v1/transactions/extract-receipt", { method: "POST", body: fd });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload.data as {
        txn_date: string | null; amount: number | null; tax_amount: number | null;
        total_amount: number | null; currency: string | null; counterparty_name: string | null;
        description: string | null; txn_type: "income" | "expense" | null;
        payment_method: string | null; confidence: number | null; notes: string | null;
      };
    },
    onSuccess: (d) => {
      setForm({
        ...form,
        txn_type: d.txn_type ?? form.txn_type,
        txn_date: d.txn_date ?? form.txn_date,
        // 공급가액이 안 읽히면 총액이라도 넣는다 — 부가세는 사람이 나눈다.
        amount: form.amount || String(d.amount ?? d.total_amount ?? ""),
        tax_amount: form.tax_amount || (d.tax_amount != null ? String(d.tax_amount) : ""),
        currency: form.currency || d.currency || brand.currency,
        counterparty_name: form.counterparty_name || d.counterparty_name || "",
        description: form.description || d.description || "",
        payment_method: d.payment_method ?? form.payment_method,
      });
      toast({
        title: t("transaction.ocr_done"),
        description: d.notes ?? (d.confidence != null ? t("transaction.ocr_confidence", { pct: Math.round(d.confidence * 100) }) : undefined),
      });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

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
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{form.id ? t("transaction.edit") : t("transaction.new")}</span>
            {!form.id && (
              <>
                <input
                  ref={ocrRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) ocr.mutate(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={ocr.isPending}
                  onClick={() => ocrRef.current?.click()}>
                  {ocr.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ScanLine className="h-3.5 w-3.5 mr-1" />}
                  {t("transaction.ocr_upload")}
                </Button>
              </>
            )}
          </DialogTitle>
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
