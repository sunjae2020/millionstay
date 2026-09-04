import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowDownLeft, ArrowRightLeft, ArrowUpRight, BookOpen, CheckCircle2,
  FileText, Loader2, Send, XCircle, Ban, Banknote,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}
