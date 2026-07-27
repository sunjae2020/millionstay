import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Lock, Trash2, Send } from "lucide-react";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

// Admin move-out deposit settlement: snapshot Deposits Held, itemise damage
// deductions (linked to move-out condition evidence), propose to the tenant,
// finalize (posts the GL entry releasing the liability). See
// docs/proposals/CONDITION_REPORTS_SETTLEMENT.md.

type Deduction = { id: number; description: string; amount: string; condition_item_id: number | null };
type Settlement = {
  id: number; settlement_ref: string; status: string;
  deposit_held: string; total_deducted: string; refund_amount: string; currency: string;
  notes: string | null; deductions: Deduction[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  proposed: "bg-blue-50 text-blue-700",
  tenant_ack: "bg-green-50 text-green-700",
  finalized: "bg-gray-200 text-gray-700",
};


export function BookingDepositSettlement({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["deposit-settlements", bookingId];
  const { data: settlements } = useQuery<Settlement[]>({
    queryKey: key,
    queryFn: async () => {
      const list = await apiJson<{ data: { id: number }[] }>(`/api/v1/bookings/${bookingId}/deposit-settlements`);
      return Promise.all((list.data ?? []).map((s) => apiJson<{ data: Settlement }>(`/api/v1/deposit-settlements/${s.id}`).then((j) => j.data)));
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  async function create() {
    await apiJson(`/api/v1/bookings/${bookingId}/deposit-settlements`, { method: "POST", body: "{}" });
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

function SettlementCard({ s, onChanged }: { s: Settlement; onChanged: () => void }) {
  const { t } = useTranslation();
  const { currencyPosition } = useBrand();
  const money = (n: string | number, ccy: string) => formatMoney(n, ccy, currencyPosition);
  const editable = s.status === "draft" || s.status === "proposed";
  const [showAdd, setShowAdd] = useState(false);

  async function addDeduction(p: { description: string; amount: number }) {
    await apiJson(`/api/v1/deposit-settlements/${s.id}/deductions`, { method: "POST", body: JSON.stringify(p) });
    setShowAdd(false); onChanged();
  }
  async function removeDeduction(did: number) {
    await apiJson(`/api/v1/deposit-settlements/${s.id}/deductions/${did}`, { method: "DELETE" });
    onChanged();
  }
  async function propose() { await apiJson(`/api/v1/deposit-settlements/${s.id}/propose`, { method: "POST", body: "{}" }); onChanged(); }
  async function finalize() { await apiJson(`/api/v1/deposit-settlements/${s.id}/finalize`, { method: "POST", body: "{}" }); onChanged(); }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{s.settlement_ref}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? "bg-gray-100"}`}>{s.status}</span>
        </div>
        <div className="flex gap-2">
          {s.status === "draft" && <Button size="sm" variant="outline" onClick={propose}><Send className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.propose")}</Button>}
          {s.status !== "finalized" && <Button size="sm" onClick={finalize}><Lock className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.finalize_post")}</Button>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("deposit_settlement.deposit_held")}</p><p className="font-semibold">{money(s.deposit_held, s.currency)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t("deposit_settlement.deductions")}</p><p className="font-semibold text-red-600">−{money(s.total_deducted, s.currency)}</p></div>
          <div className="rounded-lg border p-3 bg-green-50/40"><p className="text-xs text-muted-foreground">{t("deposit_settlement.refund")}</p><p className="font-semibold text-green-700">{money(s.refund_amount, s.currency)}</p></div>
        </div>

        <div className="space-y-1.5">
          {s.deductions.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
              <span>{d.description}{d.condition_item_id ? <span className="ml-2 text-[11px] text-muted-foreground">↳ {t("deposit_settlement.evidence", { id: d.condition_item_id })}</span> : null}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-red-600">−{money(d.amount, s.currency)}</span>
                {editable && <button onClick={() => removeDeduction(d.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
              </span>
            </div>
          ))}
          {!s.deductions.length && <p className="text-sm text-muted-foreground">{t("deposit_settlement.no_deductions")}</p>}
        </div>

        {editable && (showAdd ? (
          <AddDeductionForm onAdd={addDeduction} onCancel={() => setShowAdd(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" /> {t("deposit_settlement.add_deduction")}</Button>
        ))}
      </div>

      {s.status === "finalized" && <div className="px-4 py-2 border-t bg-gray-50 text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t("deposit_settlement.finalized_gl")}</div>}
    </div>
  );
}

function AddDeductionForm({ onAdd, onCancel }: { onAdd: (p: { description: string; amount: number }) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const valid = description.trim() && Number(amount) > 0;
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <div className="flex gap-2 flex-wrap">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("deposit_settlement.placeholder_description")} className="border rounded px-2 py-1.5 text-sm flex-1 min-w-[200px]" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={t("common.amount")} className="border rounded px-2 py-1.5 text-sm w-32" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid} onClick={() => onAdd({ description: description.trim(), amount: Number(amount) })}>{t("common.add")}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
