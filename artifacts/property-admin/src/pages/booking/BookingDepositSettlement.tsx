import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Lock, Unlock, Trash2, Send, FileText, Receipt, TriangleAlert } from "lucide-react";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { SettlementSignLinkCard } from "@/components/SettlementSignLinkCard";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

// Admin move-out deposit settlement: snapshot Deposits Held, itemise damage
// deductions (linked to move-out condition evidence), propose to the tenant,
// finalize (posts the GL entry releasing the liability). See
// docs/proposals/CONDITION_REPORTS_SETTLEMENT.md.

// A line is signed: positive deducts from the deposit (차감(−)), negative refunds
// the tenant (환급(+)). `remark` is the 비고 column on the 퇴거 세대 정산 확인서.
type LineKind = "deduct" | "refund";
type Deduction = {
  id: number; description: string; amount: string; remark: string | null;
  condition_item_id: number | null;
  /** 확인서 2번 표의 "구분". 금액 부호가 정본이고, 0원 라인은 이 값만이 의도를 말한다. */
  kind: LineKind;
};
/** 확인서 1번 표(기본 임대차 정보) — 서버가 PDF와 같은 조립기로 채워 보낸다. */
type SettlementForm = {
  unit: string | null;
  tenant_name: string | null;
  contract_start: string | null;
  contract_end: string | null;
  monthly_rent: string | number | null;
  settlement_type: "early" | "expiry" | null;
  as_of_date: string | null;
};
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
  form: SettlementForm | null;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  proposed: "bg-blue-50 text-blue-700",
  tenant_ack: "bg-green-50 text-green-700",
  finalized: "bg-gray-200 text-gray-700",
};


function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "—";
  const d = (v: string | null) => (v ? String(v).slice(0, 10) : "—");
  return `${d(from)} ~ ${d(to)}`;
}

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
        <h4 className="font-medium text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> {t("deposit_settlement.tab_title")}</h4>
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
  // 확정된 확인서도 고칠 수 있다 — 다만 원장을 흔드는 일이므로 "수정" 버튼으로
  // 명시적으로 확정을 되돌린(reopen) 뒤에만 편집이 열린다.
  const editable = s.status !== "finalized";
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const cur = s.currency;
  const form = s.form;

  /** 차감은 붉은 −, 환급은 파란 +. 종이 서식의 색 규칙을 그대로 따른다. */
  function signed(amount: number) {
    const abs = money(Math.abs(amount), cur);
    if (amount > 0) return <span className="text-red-600 font-medium">−{abs}</span>;
    if (amount < 0) return <span className="text-blue-700 font-medium">+{abs}</span>;
    return <span>{abs}</span>;
  }

  async function addDeduction(p: { description: string; amount: number; kind: LineKind; remark: string }) {
    await apiJson(`/api/v1/deposit-settlements/${s.id}/deductions`, { method: "POST", body: JSON.stringify(p) });
    setShowAdd(false); onChanged();
  }
  // 표준 서식 뼈대와 0원으로 깔린 하자 라인에 금액·구분·비고를 채워 넣는 경로.
  async function patchDeduction(did: number, patch: { amount?: number; kind?: LineKind; description?: string; remark?: string | null }) {
    await apiJson(`/api/v1/deposit-settlements/${s.id}/deductions/${did}`, { method: "PATCH", body: JSON.stringify(patch) });
    onChanged();
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
  // 확정 취소 — 확인서 번호는 그대로 두고 상태만 draft 로 되돌린다. 전기된 전표가
  // 있으면 서버가 역분개를 쌓으므로 원장은 지워지지 않는다.
  async function reopen() {
    if (!window.confirm(t("deposit_settlement.reopen_confirm"))) return;
    setBusy(true);
    try { await apiJson(`/api/v1/deposit-settlements/${s.id}/reopen`, { method: "POST", body: "{}" }); onChanged(); }
    finally { setBusy(false); }
  }

  // Preview the branded move-out confirmation ("퇴거 세대 정산 확인서") — print / download.
  // No email button: settlements have no document-email endpoint (the tenant is
  // notified through the propose step instead).
  function previewPdf() {
    openPreview({
      title: s.settlement_ref,
      filename: `${s.settlement_ref}.pdf`,
      source: { kind: "api", path: `/api/v1/deposit-settlements/${s.id}/document.pdf` },
    });
  }

  const totalA = Number(s.total_deducted ?? 0);
  const depositB = Number(s.deposit_held ?? 0);
  const finalC = Number(s.net_amount ?? 0);

  const th = "border px-3 py-2 text-xs font-semibold text-center";
  const td = "border px-3 py-2 align-middle";

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{s.settlement_ref}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? "bg-gray-100"}`}>{s.status}</span>
          {form?.as_of_date && (
            <span className="text-xs text-muted-foreground">{t("deposit_settlement.as_of")}: {String(form.as_of_date).slice(0, 10)}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={previewPdf}><FileText className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.download_pdf")}</Button>
          {s.shortfall > 0 && !s.invoice_id && (
            <Button size="sm" variant="outline" onClick={issueInvoice}><Receipt className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.issue_invoice")}</Button>
          )}
          {s.status === "draft" && <Button size="sm" variant="outline" onClick={propose}><Send className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.propose")}</Button>}
          {s.status === "finalized"
            ? <Button size="sm" variant="outline" disabled={busy} onClick={reopen}><Unlock className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.reopen")}</Button>
            : <Button size="sm" onClick={finalize}><Lock className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.finalize_post")}</Button>}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* 임차인 확인 서명 링크 — 정산안이 제안된 뒤에 보낸다. */}
        <SettlementSignLinkCard settlementId={s.id} status={s.status} defaultEmail={(s as any).tenant_email ?? null} />

        {/* 1. 기본 임대차 정보 — 서식 1번 표 그대로. */}
        <section className="space-y-1.5">
          <h5 className="text-xs font-bold text-primary">1. {t("deposit_settlement.sec_basic")}</h5>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <th className={`${th} bg-gray-50 w-[16%]`}>{t("deposit_settlement.f_unit")}</th>
                <td className={`${td} text-center w-[34%]`}>{form?.unit || "—"}</td>
                <th className={`${th} bg-gray-50 w-[16%]`}>{t("deposit_settlement.f_tenant")}</th>
                <td className={`${td} text-center w-[34%]`}>{form?.tenant_name || "—"}</td>
              </tr>
              <tr>
                <th className={`${th} bg-gray-50`}>{t("deposit_settlement.f_period")}</th>
                <td className={`${td} text-center`}>{formatPeriod(form?.contract_start ?? null, form?.contract_end ?? null)}</td>
                <th className={`${th} bg-gray-50`}>{t("deposit_settlement.f_monthly_rent")}</th>
                <td className={`${td} text-center`}>{form?.monthly_rent == null ? "—" : money(form.monthly_rent, cur)}</td>
              </tr>
              <tr>
                <th className={`${th} bg-gray-50`}>{t("deposit_settlement.f_deposit")}</th>
                <td className={`${td} text-center`}>{money(depositB, cur)}</td>
                <th className={`${th} bg-gray-50`}>{t("deposit_settlement.f_settle_type")}</th>
                <td className={`${td} text-center`}>
                  {t("deposit_settlement.type_early")}({form?.settlement_type === "early" ? "O" : "X"})
                  {" / "}
                  {t("deposit_settlement.type_expiry")}({form?.settlement_type === "expiry" ? "O" : "X"})
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 2. 퇴거 정산 내역 — 항목 라인 + A/B/C 합계행. */}
        <section className="space-y-1.5">
          <h5 className="text-xs font-bold text-primary">2. {t("deposit_settlement.sec_lines")}</h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className={`${th} w-[6%]`}>{t("deposit_settlement.col_no")}</th>
                  <th className={`${th} w-[24%]`}>{t("deposit_settlement.col_item")}</th>
                  <th className={`${th} w-[13%]`}>{t("deposit_settlement.col_kind")}</th>
                  <th className={`${th} w-[19%]`}>{t("deposit_settlement.col_amount")}</th>
                  <th className={`${th} w-[38%]`}>{t("deposit_settlement.col_remark")}</th>
                </tr>
              </thead>
              <tbody>
                {!s.deductions.length && (
                  <tr><td className={`${td} text-center text-muted-foreground`} colSpan={5}>{t("deposit_settlement.no_deductions")}</td></tr>
                )}
                {s.deductions.map((d, i) => {
                  const amount = Number(d.amount ?? 0);
                  return (
                    <tr key={d.id}>
                      <td className={`${td} text-center text-muted-foreground`}>{i + 1}</td>
                      <td className={td}>
                        {editable ? (
                          <input
                            defaultValue={d.description}
                            className="border rounded px-2 py-1 text-sm w-full"
                            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== d.description) patchDeduction(d.id, { description: v }); }}
                          />
                        ) : d.description}
                        {d.condition_item_id ? (
                          <span className="ml-2 text-[11px] text-muted-foreground">↳ {t("deposit_settlement.evidence", { id: d.condition_item_id })}</span>
                        ) : null}
                      </td>
                      <td className={`${td} text-center`}>
                        {editable ? (
                          <select
                            value={d.kind}
                            className="border rounded px-1.5 py-1 text-sm"
                            onChange={(e) => patchDeduction(d.id, { kind: e.target.value as LineKind })}
                          >
                            <option value="deduct">{t("deposit_settlement.kind_deduct")}</option>
                            <option value="refund">{t("deposit_settlement.kind_refund")}</option>
                          </select>
                        ) : (
                          <span className={d.kind === "refund" ? "text-blue-700 font-medium" : "text-red-600 font-medium"}>
                            {d.kind === "refund" ? t("deposit_settlement.kind_refund") : t("deposit_settlement.kind_deduct")}
                          </span>
                        )}
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        {editable ? (
                          <div className="flex items-center justify-end gap-1">
                            {/* 금액은 절댓값으로 입력하고 부호는 구분이 정한다. */}
                            <input
                              defaultValue={Math.abs(amount)}
                              type="number" min="0" step="0.01"
                              className="border rounded px-2 py-1 text-sm w-28 text-right"
                              onBlur={(e) => { const v = Math.abs(Number(e.target.value)); if (Number.isFinite(v) && v !== Math.abs(amount)) patchDeduction(d.id, { amount: v }); }}
                            />
                            <button onClick={() => removeDeduction(d.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : signed(amount)}
                      </td>
                      <td className={td}>
                        {editable ? (
                          <input
                            defaultValue={d.remark ?? ""}
                            placeholder={t("deposit_settlement.placeholder_remark")}
                            className="border rounded px-2 py-1 text-xs w-full"
                            onBlur={(e) => { if (e.target.value !== (d.remark ?? "")) patchDeduction(d.id, { remark: e.target.value }); }}
                          />
                        ) : <span className="text-xs text-muted-foreground">{d.remark || ""}</span>}
                      </td>
                    </tr>
                  );
                })}

                {/* A = 차감액 + 환급액 통산, B = 기 납부 보증금, C = B + A. */}
                <tr className="bg-gray-50 font-semibold">
                  <td className={`${th} bg-gray-100`}>A</td>
                  <td className={td} colSpan={2}>{t("deposit_settlement.row_a")}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{signed(totalA)}</td>
                  <td className={`${td} text-xs font-normal text-muted-foreground`}>{t("deposit_settlement.row_a_remark")}</td>
                </tr>
                <tr className="bg-gray-50 font-semibold">
                  <td className={`${th} bg-gray-100`}>B</td>
                  <td className={td} colSpan={2}>{t("deposit_settlement.row_b")}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{money(depositB, cur)}</td>
                  <td className={`${td} text-xs font-normal text-muted-foreground`}>{t("deposit_settlement.row_b_remark")}</td>
                </tr>
                <tr className="bg-amber-50 font-bold">
                  <td className={`${th} bg-amber-100`}>C</td>
                  <td className={td} colSpan={2}>{t("deposit_settlement.row_c")}</td>
                  <td className={`${td} text-right whitespace-nowrap ${finalC < 0 ? "text-red-700" : ""}`}>
                    {finalC < 0 ? `−${money(Math.abs(finalC), cur)}` : money(finalC, cur)}
                  </td>
                  <td className={`${td} text-xs font-normal text-muted-foreground`}>{t("deposit_settlement.row_c_remark")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {editable && (showAdd ? (
            <AddDeductionForm onAdd={addDeduction} onCancel={() => setShowAdd(false)} />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.add_deduction")}</Button>
          ))}
        </section>

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
      </div>

      {s.status === "finalized" && <div className="px-4 py-2 border-t bg-gray-50 text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t("deposit_settlement.finalized_gl")}</div>}

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}

function AddDeductionForm({ onAdd, onCancel }: { onAdd: (p: { description: string; amount: number; kind: LineKind; remark: string }) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [kind, setKind] = useState<LineKind>("deduct");
  const valid = description.trim() && Number(amount) >= 0 && amount !== "";
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex gap-2 flex-wrap">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("deposit_settlement.placeholder_description")} className="border rounded px-2 py-1.5 text-sm flex-1 min-w-[200px]" />
        {/* 구분: 차감(−) deducts from the deposit, 환급(+) gives it back. */}
        <select value={kind} onChange={(e) => setKind(e.target.value as LineKind)} className="border rounded px-2 py-1.5 text-sm">
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
