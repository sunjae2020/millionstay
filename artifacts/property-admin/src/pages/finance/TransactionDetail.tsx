import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowDownLeft, ArrowRightLeft, ArrowUpRight, BookOpen, CheckCircle2,
  FileText, Loader2, Send, XCircle, Ban, Banknote, Split, Sparkles, Plus, Trash2, CopyCheck,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { useDocumentPreview, DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { PaymentScheduleCard } from "@/components/PaymentScheduleCard";

/**
 * 거래 상세 — 한 건에 얽힌 모든 것을 한 화면에 모은다.
 *
 * 목록의 편집 팝업만 있을 때는 결재 이력·분개·영수증을 붙일 자리가 없었다.
 * 여기서는 "이 돈이 어디서 와서 어느 회차를 정산하고 원장에 어떻게 찍혔는지"가
 * 한 줄로 읽혀야 한다.
 */

interface TxnDetail {
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
  schedule_period: string | null;
  schedule_due_date: string | null;
  counterparty_display: string | null;
  bank_account_name: string | null;
  gl_account_code: string | null;
  gl_account_name: string | null;
  description: string | null;
  bank_reference: string | null;
  notes: string | null;
  status: string;
  workflow_status: string;
  journal_entry_id: number | null;
  rejection_reason: string | null;
  base_amount: number | null;
  split_leg_count: number;
  split_role: string | null;
  parent_transaction_id: number | null;
}

const WF_META: Record<string, { cls: string }> = {
  draft:     { cls: "bg-gray-100 text-gray-600" },
  submitted: { cls: "bg-amber-100 text-amber-700" },
  posted:    { cls: "bg-blue-100 text-blue-700" },
  confirmed: { cls: "bg-indigo-100 text-indigo-700" },
  paid:      { cls: "bg-green-100 text-green-700" },
  rejected:  { cls: "bg-red-100 text-red-700" },
  void:      { cls: "bg-gray-100 text-gray-400 line-through" },
};

const TYPE_META: Record<string, { icon: typeof ArrowDownLeft; cls: string }> = {
  income:   { icon: ArrowDownLeft,  cls: "text-green-600" },
  expense:  { icon: ArrowUpRight,   cls: "text-red-600" },
  transfer: { icon: ArrowRightLeft, cls: "text-blue-600" },
};

export default function TransactionDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = useBrand();
  const [, params] = useRoute("/finance/transactions/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<{ code: string; name: string | null; reason: string | null } | null>(null);

  const { data, isLoading } = useQuery<{ data: TxnDetail }>({
    queryKey: ["transaction", id],
    enabled: Number.isFinite(id),
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/transactions/${id}`);
      if (!res.ok) throw new Error("Failed to load transaction");
      return res.json();
    },
  });
  const txn = data?.data;

  const { data: entry } = useQuery<{ data: Array<{ id: number; posting_key: string; description: string; entry_date: string; lines: Array<{ account_code: string; account_name: string; debit: string; credit: string }> }> }>({
    queryKey: ["gl-entries-all"],
    enabled: !!txn?.journal_entry_id,
    queryFn: async () => {
      const res = await apiFetch("/api/v1/gl/entries");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const journal = useMemo(
    () => entry?.data?.find((e) => e.id === txn?.journal_entry_id),
    [entry, txn?.journal_entry_id],
  );

  const { data: legs } = useQuery<{ data: Array<{ id: number; txn_ref: string; amount: number; split_role: string; counterparty_display: string | null; description: string | null; status: string }> }>({
    queryKey: ["transaction-legs", id],
    enabled: !!txn?.split_leg_count,
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/transactions/${id}/split-children`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // 중복 감지는 규칙 기반이라 화면을 열 때마다 조용히 돌려도 부담이 없다.
  const { data: dupes } = useQuery<{ data: Array<{ id: number; txn_ref: string; amount: number }> }>({
    queryKey: ["transaction-dupes", id],
    enabled: Number.isFinite(id),
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/transactions/${id}/duplicates`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const suggest = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/transactions/${id}/suggest`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload as { suggestion: { code: string; name: string | null; reason: string | null } | null };
    },
    onSuccess: (r) => {
      setSuggestion(r.suggestion);
      if (!r.suggestion) toast({ title: t("transaction.suggest_none") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const act = useMutation({
    mutationFn: async ({ verb, body }: { verb: string; body?: unknown }) => {
      const res = await apiFetch(`/api/v1/transactions/${id}/${verb}`, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction", id] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["payment-schedule"] });
      qc.invalidateQueries({ queryKey: ["gl-entries-all"] });
      setRejectOpen(false);
      setReason("");
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  if (isLoading || !txn) {
    return <Layout><div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div></Layout>;
  }

  const money = (n: number) => formatMoney(n, txn.currency, brand.currencyPosition);
  const Icon = TYPE_META[txn.txn_type]?.icon ?? ArrowRightLeft;
  const wf = txn.workflow_status ?? "draft";
  const settled = txn.status === "confirmed" || txn.status === "posted";

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={`h-5 w-5 shrink-0 ${TYPE_META[txn.txn_type]?.cls ?? ""}`} />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{txn.txn_ref}</h1>
              <p className="text-sm text-muted-foreground">
                {formatDate(txn.txn_date)} · {t(`transaction.type_${txn.txn_type}`)}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${WF_META[wf]?.cls ?? WF_META.draft.cls}`}>
              {t(`transaction.wf_${wf}`)}
            </span>
          </div>
          <Button variant="outline" onClick={() => navigate("/finance/transactions")}>
            <ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}
          </Button>
        </div>

        {/* 반려 사유는 가장 먼저 보여야 한다 — 무엇을 고쳐야 하는지가 이 화면의 용건이다. */}
        {wf === "rejected" && txn.rejection_reason && (
          <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-sm">
            <div className="font-medium text-red-700">{t("transaction.wf_rejected")}</div>
            <p className="text-red-600 mt-0.5">{txn.rejection_reason}</p>
          </div>
        )}

        {/* 같은 날·같은 금액·같은 거래처가 이미 있으면 알린다. 두 번 입력했을
            가능성이 높고, 전기까지 가면 되돌리기가 번거롭다. */}
        {(dupes?.data?.length ?? 0) > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-amber-800">
              <CopyCheck className="h-4 w-4" />{t("transaction.dupe_warning", { count: dupes!.data.length })}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {dupes!.data.map((d) => (
                <Link key={d.id} href={`/finance/transactions/${d.id}`} className="text-amber-700 underline">
                  {d.txn_ref}
                </Link>
              ))}
            </div>
          </div>
        )}

        {suggestion && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 text-sm flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-800">{suggestion.code} · {suggestion.name}</span>
            {suggestion.reason && <span className="text-blue-700">— {suggestion.reason}</span>}
            <Button size="sm" className="ml-auto h-7"
              onClick={async () => {
                await apiFetch(`/api/v1/transactions/${id}`, {
                  method: "PUT", body: JSON.stringify({ gl_account_code: suggestion.code }),
                });
                setSuggestion(null);
                qc.invalidateQueries({ queryKey: ["transaction", id] });
              }}>
              {t("transaction.suggest_apply")}
            </Button>
          </div>
        )}

        {/* 결재 단계 */}
        <div className="flex flex-wrap items-center gap-2">
          {(wf === "draft" || wf === "rejected") && (
            <Button size="sm" onClick={() => act.mutate({ verb: "submit" })} disabled={act.isPending}>
              <Send className="h-3.5 w-3.5 mr-1" />{t("transaction.submit")}
            </Button>
          )}
          {txn.status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => act.mutate({ verb: "confirm" })} disabled={act.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("transaction.confirm")}
            </Button>
          )}
          {txn.status !== "posted" && txn.status !== "void" && (
            <Button size="sm" variant="outline" onClick={() => act.mutate({ verb: "post" })} disabled={act.isPending}>
              <BookOpen className="h-3.5 w-3.5 mr-1" />{t("transaction.post")}
            </Button>
          )}
          {txn.status === "posted" && wf !== "paid" && (
            <Button size="sm" variant="outline" onClick={() => act.mutate({ verb: "mark-paid" })} disabled={act.isPending}>
              <Banknote className="h-3.5 w-3.5 mr-1" />{t("transaction.mark_paid")}
            </Button>
          )}
          {wf === "submitted" && (
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectOpen(true)}>
              <Ban className="h-3.5 w-3.5 mr-1" />{t("transaction.reject")}
            </Button>
          )}
          {settled && (
            <Button
              size="sm" variant="outline"
              onClick={() => openPreview({
                title: `${t("transaction.receipt")} · ${txn.invoice_ref ?? txn.txn_ref}`,
                // 실제 파일명은 서버가 Content-Disposition 으로 준다(문서 파일명 규칙).
                filename: `${txn.invoice_ref ?? txn.txn_ref}.pdf`,
                source: { kind: "api", path: `/api/v1/transactions/${txn.id}/receipt/pdf` },
              })}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />{t("transaction.receipt")}
            </Button>
          )}
          {txn.txn_type === "income" && !txn.parent_transaction_id && txn.status !== "void" && (
            <Button size="sm" variant="outline"
              onClick={() => (txn.split_leg_count ? act.mutate({ verb: "unsplit" }) : setSplitOpen(true))}>
              <Split className="h-3.5 w-3.5 mr-1" />
              {txn.split_leg_count ? t("transaction.unsplit") : t("transaction.split")}
            </Button>
          )}
          {!txn.gl_account_code && txn.txn_type !== "transfer" && (
            <Button size="sm" variant="outline" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
              {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              {t("transaction.suggest")}
            </Button>
          )}
          {txn.status !== "void" && (
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600"
              onClick={() => act.mutate({ verb: "void" })} disabled={act.isPending}>
              <XCircle className="h-3.5 w-3.5 mr-1" />{t("transaction.void")}
            </Button>
          )}
          {act.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="border rounded-lg bg-card px-4 py-3">
            <h3 className="font-semibold mb-2">{t("transaction.section_summary")}</h3>
            <Row label={t("transaction.col_amount")}>
              <span className={`font-semibold tabular-nums ${TYPE_META[txn.txn_type]?.cls ?? ""}`}>
                {txn.txn_type === "expense" ? "−" : ""}{money(txn.amount)}
              </span>
            </Row>
            {txn.tax_amount > 0 && <Row label={t("transaction.field_tax")}>{money(txn.tax_amount)}</Row>}
            <Row label={t("transaction.col_counterparty")}>{txn.counterparty_display ?? "—"}</Row>
            <Row label={t("transaction.col_bank_account")}>{txn.bank_account_name ?? "—"}</Row>
            <Row label={t("transaction.col_gl_account")}>
              {txn.gl_account_code ? `${txn.gl_account_code} · ${txn.gl_account_name ?? ""}` : t("transaction.gl_auto")}
            </Row>
            <Row label={t("transaction.field_bank_reference")}>{txn.bank_reference ?? "—"}</Row>
            <Row label={t("transaction.field_description")}>{txn.description ?? "—"}</Row>
          </div>

          <div className="border rounded-lg bg-card px-4 py-3">
            <h3 className="font-semibold mb-2">{t("transaction.section_link")}</h3>
            <Row label={t("transaction.col_contract")}>
              {txn.contract_id
                ? <Link href={`/contracts/${txn.contract_id}`} className="text-primary hover:underline">{txn.contract_ref}</Link>
                : "—"}
            </Row>
            <Row label={t("transaction.col_invoice")}>
              {txn.invoice_id
                ? <Link href={`/finance/invoices/${txn.invoice_id}`} className="text-primary hover:underline">{txn.invoice_ref}</Link>
                : "—"}
            </Row>
            <Row label={t("transaction.col_schedule")}>
              {txn.payment_schedule_id
                ? `${t(`payment_schedule.kind_${txn.schedule_kind ?? "other"}`)}${txn.schedule_period ? ` ${txn.schedule_period}` : ""}`
                : "—"}
            </Row>
            <Row label={t("payment_schedule.col_due")}>{formatDate(txn.schedule_due_date) || "—"}</Row>
          </div>
        </div>

        {/* 분개 — "원장에 어떻게 찍혔는지"를 여기서 바로 본다. 이걸 못 보면
            전기가 맞는지 확인하려고 매번 원장 화면으로 건너가야 한다. */}
        {journal && (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between">
              <h3 className="font-semibold">{t("transaction.section_journal")}</h3>
              <span className="text-xs text-muted-foreground">{journal.posting_key} · {journal.entry_date}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/10">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("journal.col_account")}</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("journal.col_debit")}</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("journal.col_credit")}</th>
                </tr>
              </thead>
              <tbody>
                {journal.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2"><span className="font-medium">{l.account_code}</span> <span className="text-muted-foreground">{l.account_name}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(l.debit) ? money(Number(l.debit)) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(l.credit) ? money(Number(l.credit)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(legs?.data?.length ?? 0) > 0 && (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/20">
              <h3 className="font-semibold">{t("transaction.section_legs", { count: legs!.data.length })}</h3>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {legs!.data.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/finance/transactions/${l.id}`} className="text-primary hover:underline">{l.txn_ref}</Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{t(`transaction.leg_${l.split_role}`)}</td>
                    <td className="px-4 py-2">{l.counterparty_display ?? l.description ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {txn.contract_id && (
          <PaymentScheduleCard contractId={txn.contract_id} currency={txn.currency} readOnly />
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("transaction.reject")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("transaction.reject_hint")}</p>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || act.isPending}
              onClick={() => act.mutate({ verb: "reject", body: { reason: reason.trim() } })}
            >
              {t("transaction.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SplitDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        txnId={id}
        total={txn.amount}
        currency={txn.currency}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["transaction", id] });
          qc.invalidateQueries({ queryKey: ["transaction-legs", id] });
          qc.invalidateQueries({ queryKey: ["transactions"] });
        }}
      />

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}

type Leg = { amount: string; role: "disbursement" | "retained"; counterparty_name: string; description: string };

/**
 * 분할 배분 입력. 원본 금액을 넘지 못하게 막고, 남은 금액을 계속 보여준다 —
 * 나누다 보면 얼마가 남았는지가 유일하게 알고 싶은 값이다.
 */
function SplitDialog({
  open, onOpenChange, txnId, total, currency, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  txnId: number;
  total: number;
  currency: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const brand = useBrand();
  const [legs, setLegs] = useState<Leg[]>([{ amount: "", role: "disbursement", counterparty_name: "", description: "" }]);

  const used = legs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = Math.round((total - used) * 100) / 100;
  const money = (n: number) => formatMoney(n, currency, brand.currencyPosition);

  // 제안은 계약 정산 조건이 있으면 그 산수를, 없으면 모델을 쓴다. 어느 쪽이든
  // 서버가 합계를 원본 이하로 잘라 주므로 그대로 채워 넣어도 안전하다.
  const suggest = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/transactions/${txnId}/split-suggest`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
      return payload.data as {
        legs: Array<{ amount: number; role: "disbursement" | "retained"; counterparty_name: string | null; description: string | null; basis: string }>;
      };
    },
    onSuccess: (d) => {
      if (!d.legs.length) { toast({ title: t("transaction.split_suggest_none") }); return; }
      setLegs(d.legs.map((l) => ({
        amount: String(l.amount),
        role: l.role,
        counterparty_name: l.counterparty_name ?? "",
        description: l.description ?? "",
      })));
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/transactions/${txnId}/split`, {
        method: "POST",
        body: JSON.stringify({
          legs: legs
            .filter((l) => Number(l.amount) > 0)
            .map((l) => ({
              amount: Number(l.amount),
              role: l.role,
              counterparty_name: l.counterparty_name || null,
              description: l.description || null,
            })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed");
    },
    onSuccess: () => { onDone(); onOpenChange(false); setLegs([{ amount: "", role: "disbursement", counterparty_name: "", description: "" }]); },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t("transaction.split")}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("transaction.split_hint", { total: money(total) })}
        </p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {legs.map((leg, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                {i === 0 && <Label className="text-xs">{t("transaction.col_amount")}</Label>}
                <Input type="number" value={leg.amount}
                  onChange={(e) => setLegs(legs.map((l, j) => j === i ? { ...l, amount: e.target.value } : l))} />
              </div>
              <div className="col-span-3">
                {i === 0 && <Label className="text-xs">{t("transaction.leg_role")}</Label>}
                <Select value={leg.role} onValueChange={(v) => setLegs(legs.map((l, j) => j === i ? { ...l, role: v as Leg["role"] } : l))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disbursement">{t("transaction.leg_disbursement")}</SelectItem>
                    <SelectItem value="retained">{t("transaction.leg_retained")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-5">
                {i === 0 && <Label className="text-xs">{t("transaction.col_counterparty")}</Label>}
                <Input value={leg.counterparty_name}
                  onChange={(e) => setLegs(legs.map((l, j) => j === i ? { ...l, counterparty_name: e.target.value } : l))} />
              </div>
              <div className="col-span-1">
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0"
                  onClick={() => setLegs(legs.filter((_, j) => j !== i))} disabled={legs.length === 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              onClick={() => setLegs([...legs, { amount: "", role: "disbursement", counterparty_name: "", description: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />{t("transaction.split_add_leg")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
              {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              {t("transaction.split_suggest")}
            </Button>
          </div>
          <span className={`text-sm tabular-nums ${remaining < 0 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
            {t("transaction.split_remaining", { amount: money(remaining) })}
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || used <= 0 || remaining < 0}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
