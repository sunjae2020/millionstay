import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Lock, Trash2, Send, FileText, Receipt, TriangleAlert } from "lucide-react";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

// Admin move-out deposit settlement: snapshot Deposits Held, itemise damage
// deductions (linked to move-out condition evidence), propose to the tenant,
// finalize (posts the GL entry releasing the liability). See
// docs/proposals/CONDITION_REPORTS_SETTLEMENT.md.

// A line is signed: positive deducts from the deposit (차감(−)), negative refunds
// the tenant (환급(+)). `remark` is the 비고 column on the 퇴거 세대 정산 확인서.
type Deduction = { id: number; description: string; amount: string; remark: string | null; condition_item_id: number | null };
type Settlement = {
  id: number; settlement_ref: string; status: string;
  deposit_held: string; total_deducted: string; refund_amount: string; currency: string;
  /** C = B − A, 부호 있는 값. 마이너스면 임차인이 더 내야 한다. */
  net_amount: number;
  /** 차감이 보증금을 넘은 금액 — 인보이스로 회수할 대상. */
  shortfall: number;
  /** 보증금(B)을 어디서 읽었는지: invoice/placement 만 GL(2100) 뒷받침. */
  deposit_source: string | null;
  invoice_id: number | null;
  notes: string | null; deductions: Deduction[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  proposed: "bg-blue-50 text-blue-700",
  tenant_ack: "bg-green-50 text-green-700",
  finalized: "bg-gray-200 text-gray-700",
};


/**
 * The same panel serves both spines: a booking (short-term/homestay) and a
 * contract (Korean monthly lease). Only the collection URL differs.
 */
export function DepositSettlementPanel({ scope, id }: { scope: "booking" | "contract"; id: string | number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const base = scope === "booking" ? `/api/v1/bookings/${id}` : `/api/v1/contracts/${id}`;
  const key = ["deposit-settlements", scope, String(id)];
  const { data: settlements } = useQuery<Settlement[]>({
    queryKey: key,
    queryFn: async () => {
      const list = await apiJson<{ data: { id: number }[] }>(`${base}/deposit-settlements`);
      return Promise.all((list.data ?? []).map((s) => apiJson<{ data: Settlement }>(`/api/v1/deposit-settlements/${s.id}`).then((j) => j.data)));
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  async function create() {
    await apiJson(`${base}/deposit-settlements`, { method: "POST", body: "{}" });
    invalidate();
  }

  return (
    <div className="space-y-4 mt-6">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> {t("deposit_settlement.title")}</h4>
        {!settlements?.length && <Button size="sm" variant="outline" onClick={create}><Plus className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.new_settlement")}</Button>}
      </div>
      {!settlements?.length ? (
        <div className="text-center py-6 text-muted-foreground text-sm rounded-lg border bg-white">{t("deposit_settlement.empty")}</div>
      ) : (
        settlements.map((s) => <SettlementCard key={s.id} s={s} onChanged={invalidate} />)
      )}
    </div>
  );
}

export function BookingDepositSettlement({ bookingId }: { bookingId: string }) {
  return <DepositSettlementPanel scope="booking" id={bookingId} />;
}

function SettlementCard({ s, onChanged }: { s: Settlement; onChanged: () => void }) {
  const { t } = useTranslation();
  const { currencyPosition } = useBrand();
  const money = (n: string | number, ccy: string) => formatMoney(n, ccy, currencyPosition);
  const editable = s.status === "draft" || s.status === "proposed";
  const [showAdd, setShowAdd] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  async function addDeduction(p: { description: string; amount: number; kind: "deduct" | "refund"; remark: string }) {
    await apiJson(`/api/v1/deposit-settlements/${s.id}/deductions`, { method: "POST", body: JSON.stringify(p) });
    setShowAdd(false); onChanged();
  }
  async function removeDeduction(did: number) {
    await apiJson(`/api/v1/deposit-settlements/${s.id}/deductions/${did}`, { method: "DELETE" });
    onChanged();
  }
  // C가 마이너스일 때만 — 보증금으로 못 메운 부족분을 인보이스로 회수한다.
  async function issueInvoice() {
    const r = await apiJson<{ data: { invoice: { id: number } } }>(`/api/v1/deposit-settlements/${s.id}/invoice`, { method: "POST", body: "{}" });
    onChanged();
    const invoiceId = r?.data?.invoice?.id;
    if (invoiceId) window.location.assign(`/finance/invoices/${invoiceId}`);
  }
  async function propose() { await apiJson(`/api/v1/deposit-settlements/${s.id}/propose`, { method: "POST", body: "{}" }); onChanged(); }
  async function finalize() { await apiJson(`/api/v1/deposit-settlements/${s.id}/finalize`, { method: "POST", body: "{}" }); onChanged(); }

  // Preview the branded move-out confirmation ("퇴거 세대 확인서") — print / download.
  // No email button: settlements have no document-email endpoint (the tenant is
  // notified through the propose step instead).
  function previewPdf() {
    openPreview({
      title: s.settlement_ref,
      filename: `${s.settlement_ref}.pdf`,
      source: { kind: "api", path: `/api/v1/deposit-settlements/${s.id}/document.pdf` },
    });
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{s.settlement_ref}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? "bg-gray-100"}`}>{s.status}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={previewPdf}><FileText className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.download_pdf")}</Button>
          {s.shortfall > 0 && !s.invoice_id && (
            <Button size="sm" variant="outline" onClick={issueInvoice}><Receipt className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.issue_invoice")}</Button>
          )}
          {s.status === "draft" && <Button size="sm" variant="outline" onClick={propose}><Send className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.propose")}</Button>}
          {s.status !== "finalized" && <Button size="sm" onClick={finalize}><Lock className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.finalize_post")}</Button>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("deposit_settlement.deposit_held")}</p><p className="font-semibold">{money(s.deposit_held, s.currency)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("deposit_settlement.deductions")}</p><p className="font-semibold text-red-600">−{money(s.total_deducted, s.currency)}</p></div>
          <div className={`rounded-lg border p-3 ${s.net_amount < 0 ? "bg-red-50/50" : "bg-green-50/40"}`}>
            <p className="text-xs text-muted-foreground">{s.net_amount < 0 ? t("deposit_settlement.payable") : t("deposit_settlement.refund")}</p>
            <p className={`font-semibold ${s.net_amount < 0 ? "text-red-700" : "text-green-700"}`}>{money(Math.abs(s.net_amount), s.currency)}</p>
          </div>
        </div>

        {s.deposit_source && (
          <p className="text-[11px] text-muted-foreground">
            {t("deposit_settlement.source_label")}: {t(`deposit_settlement.source_${s.deposit_source}`, s.deposit_source)}
            {s.deposit_source !== "invoice" && s.deposit_source !== "placement" && ` · ${t("deposit_settlement.source_not_gl")}`}
          </p>
        )}

        {s.shortfall > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {t("deposit_settlement.shortfall_notice", { amount: money(s.shortfall, s.currency) })}
              {s.invoice_id ? ` · ${t("deposit_settlement.invoice_linked", { id: s.invoice_id })}` : ""}
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          {s.deductions.map((d) => {
            const refund = Number(d.amount) < 0;
            return (
              <div key={d.id} className="flex items-start justify-between text-sm border rounded-lg px-3 py-2 gap-3">
                <span className="min-w-0">
                  {d.description}
                  {d.condition_item_id ? <span className="ml-2 text-[11px] text-muted-foreground">↳ {t("deposit_settlement.evidence", { id: d.condition_item_id })}</span> : null}
                  {d.remark ? <span className="block text-[11px] text-muted-foreground truncate">{d.remark}</span> : null}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`font-medium ${refund ? "text-blue-600" : "text-red-600"}`}>{refund ? "+" : "−"}{money(Math.abs(Number(d.amount)), s.currency)}</span>
                  {editable && <button onClick={() => removeDeduction(d.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                </span>
              </div>
            );
          })}
          {!s.deductions.length && <p className="text-sm text-muted-foreground">{t("deposit_settlement.no_deductions")}</p>}
        </div>

        {editable && (showAdd ? (
          <AddDeductionForm onAdd={addDeduction} onCancel={() => setShowAdd(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.add_deduction")}</Button>
        ))}
      </div>

      {s.status === "finalized" && <div className="px-4 py-2 border-t bg-gray-50 text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t("deposit_settlement.finalized_gl")}</div>}

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}

function AddDeductionForm({ onAdd, onCancel }: { onAdd: (p: { description: string; amount: number; kind: "deduct" | "refund"; remark: string }) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [kind, setKind] = useState<"deduct" | "refund">("deduct");
  const valid = description.trim() && Number(amount) >= 0 && amount !== "";
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex gap-2 flex-wrap">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("deposit_settlement.placeholder_description")} className="border rounded px-2 py-1.5 text-sm flex-1 min-w-[200px]" />
        {/* 구분: 차감(−) deducts from the deposit, 환급(+) gives it back. */}
        <select value={kind} onChange={(e) => setKind(e.target.value as "deduct" | "refund")} className="border rounded px-2 py-1.5 text-sm">
          <option value="deduct">{t("deposit_settlement.kind_deduct")}</option>
          <option value="refund">{t("deposit_settlement.kind_refund")}</option>
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={t("common.amount")} className="border rounded px-2 py-1.5 text-sm w-32" />
      </div>
      <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t("deposit_settlement.placeholder_remark")} className="border rounded px-2 py-1.5 text-sm w-full" />
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid} onClick={() => onAdd({ description: description.trim(), amount: Number(amount), kind, remark: remark.trim() })}>{t("common.add")}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
