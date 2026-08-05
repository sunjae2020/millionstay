import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { AlertTriangle, Plus, Pencil, Trash2, Check, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
// 정산 보드 — one contract's money in one place: what the customer paid, where
// each part of it went, and what was left for us.
//
// The point of showing the receipt broken down by charge_kind is that the
// operator can SEE which line the landlord percentage was taken from. If the
// base is invisible, an over-payment to the owner is invisible too.

type Leg = {
  id: number;
  settlement_ref: string;
  party_type: string;
  payee_display: string;
  split_role: string;
  basis_snapshot: string | null;
  rate_snapshot: string | null;
  base_amount: string | null;
  amount: string;
  currency: string;
  status: string;
  paid_at: string | null;
};

type Receipt = {
  source_id: number;
  invoice_ref: string | null;
  currency: string | null;
  paid_at: string | null;
  received: number;
  legs_total: number;
  retained: number;
  margin_pct: number | null;
  balanced: boolean;
  legs: Leg[];
};

type Term = {
  id: number;
  party_type: string;
  payee_account_id: number | null;
  payee_name: string;
  basis: string;
  rate: string | null;
  amount: string | null;
  currency: string;
  cadence: string;
  status: string;
};

const PARTY_TYPES = ["landlord", "service_host", "agent"] as const;
const BASES = ["percent_of_rent", "fixed_monthly", "fixed_once"] as const;
const CADENCES = ["monthly", "once", "per_job"] as const;

export default function SettlementBoard({ contractId }: { contractId: number | string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = useBrand();
  const money = (v: unknown, cur?: string | null) =>
    formatMoney(Number(v ?? 0), cur || brand.currency || "KRW", brand.currencyPosition);

  const { data: boardData } = useQuery({
    queryKey: ["settlement-board", contractId],
    queryFn: async () => (await apiFetch(`/api/v1/contracts/${contractId}/settlement-board`)).json(),
  });
  const { data: termsData } = useQuery({
    queryKey: ["payout-terms", contractId],
    queryFn: async () => (await apiFetch(`/api/v1/contracts/${contractId}/payout-terms`)).json(),
  });

  const receipts: Receipt[] = boardData?.data?.receipts ?? [];
  const totals = boardData?.data?.totals ?? { received: 0, retained: 0, unbalanced: 0 };
  const terms: Term[] = termsData?.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["settlement-board", contractId] });
    qc.invalidateQueries({ queryKey: ["payout-terms", contractId] });
  };

  // ── Term editor ──────────────────────────────────────────────────────────
  const [termOpen, setTermOpen] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);
  const [form, setForm] = useState({
    party_type: "landlord",
    payee_account_id: null as number | null,
    payee_name: "",
    basis: "percent_of_rent",
    rate: "",
    amount: "",
    cadence: "monthly",
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ party_type: "landlord", payee_account_id: null, payee_name: "", basis: "percent_of_rent", rate: "", amount: "", cadence: "monthly" });
    setTermOpen(true);
  };
  const openEdit = (tm: Term) => {
    setEditing(tm);
    setForm({
      party_type: tm.party_type,
      payee_account_id: tm.payee_account_id,
      payee_name: tm.payee_name ?? "",
      basis: tm.basis,
      rate: tm.rate ?? "",
      amount: tm.amount ?? "",
      cadence: tm.cadence,
    });
    setTermOpen(true);
  };

  const saveTerm = useMutation({
    mutationFn: async () => {
      const body = {
        party_type: form.party_type,
        payee_account_id: form.payee_account_id,
        payee_name: form.payee_name,
        basis: form.basis,
        rate: form.basis === "percent_of_rent" ? Number(form.rate) : null,
        amount: form.basis === "percent_of_rent" ? null : Number(form.amount),
        currency: brand.currency || "KRW",
        cadence: form.cadence,
      };
      const url = editing ? `/api/v1/payout-terms/${editing.id}` : `/api/v1/contracts/${contractId}/payout-terms`;
      const r = await apiFetch(url, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      return r.json();
    },
    onSuccess: () => { setTermOpen(false); refresh(); toast({ title: t("settlement.term_saved") }); },
    onError: (e: Error) => toast({ title: t("settlement.term_save_failed"), description: e.message, variant: "destructive" }),
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/payout-terms/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast({ title: t("settlement.term_deleted") }); },
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "pay" }) => {
      const r = await apiFetch(`/api/v1/provider-settlements/${id}/${action}`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      return r.json();
    },
    onSuccess: () => { refresh(); toast({ title: t("settlement.updated") }); },
    onError: (e: Error) => toast({ title: t("settlement.action_failed"), description: e.message, variant: "destructive" }),
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      due: "bg-amber-50 text-amber-700 border-amber-200",
      approved: "bg-blue-50 text-blue-700 border-blue-200",
      paid: "bg-green-50 text-green-700 border-green-200",
      cancelled: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{t(`settlement.status_${s}`)}</Badge>;
  };

  /** "월세의 73.5%" — why this amount is this amount. */
  const basisLabel = (l: Leg) => {
    if (!l.basis_snapshot) return "—";
    if (l.basis_snapshot === "percent_of_rent") {
      return t("settlement.basis_pct_of_rent", { rate: Number(l.rate_snapshot ?? 0) });
    }
    return t(`settlement.basis_${l.basis_snapshot}`);
  };

  return (
    <div className="space-y-4">
      {/* ── Payout terms ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium text-sm">{t("settlement.terms_title")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t("settlement.terms_desc")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("settlement.btn_add_term")}
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <ExportableTable fileName="settlement-terms" className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {[t("settlement.col_party"), t("settlement.col_payee"), t("settlement.col_basis"), t("settlement.col_cadence"), ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!terms.length ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{t("settlement.no_terms")}</td></tr>
            ) : terms.map((tm) => (
              <tr key={tm.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t(`settlement.party_${tm.party_type}`)}</td>
                <td className="px-4 py-3">{tm.payee_name || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {tm.basis === "percent_of_rent"
                    ? t("settlement.basis_pct_of_rent", { rate: Number(tm.rate ?? 0) })
                    : `${t(`settlement.basis_${tm.basis}`)} · ${money(tm.amount, tm.currency)}`}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t(`settlement.cadence_${tm.cadence}`)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(tm)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteTerm.mutate(tm.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ExportableTable>
      </div>

      {/* ── Receipts and their legs ──────────────────────────────────── */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h4 className="font-medium text-sm">{t("settlement.board_title")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t("settlement.board_desc")}</p>
        </div>
        {receipts.length > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t("settlement.total_net")}</div>
            <div className="font-mono font-bold">{money(totals.retained)}</div>
          </div>
        )}
      </div>

      {/* 관리비·공과금은 세입자 직납이라 이 장부에 나타나지 않는다. */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5" /> {t("settlement.tenant_direct_note")}
      </p>

      {!receipts.length ? (
        <div className="rounded-lg border bg-white py-10 text-center text-muted-foreground text-sm">
          {t("settlement.no_receipts")}
        </div>
      ) : receipts.map((r) => (
        <div key={r.source_id} className={`rounded-lg border bg-white overflow-hidden ${r.balanced ? "" : "border-red-300"}`}>
          <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b ${r.balanced ? "bg-gray-50" : "bg-red-50"}`}>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{r.invoice_ref ?? `#${r.source_id}`}</span>
              {r.paid_at && <span className="text-muted-foreground text-xs">{formatDate(r.paid_at)}</span>}
              {!r.balanced && (
                <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t("settlement.unbalanced")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-5 text-sm">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t("settlement.received")}</div>
                <div className="font-mono">{money(r.received, r.currency)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t("settlement.net_revenue")}</div>
                <div className="font-mono font-bold">
                  {money(r.retained, r.currency)}
                  {r.margin_pct != null && <span className="text-xs text-muted-foreground ml-1">({r.margin_pct}%)</span>}
                </div>
              </div>
            </div>
          </div>

          <ExportableTable fileName="settlement-lines" className="w-full text-sm">
            <tbody>
              {r.legs.filter((l) => l.split_role === "external_payment").map((l) => (
                <tr key={l.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 w-32 text-muted-foreground text-xs">{t(`settlement.party_${l.party_type}`)}</td>
                  <td className="px-4 py-2.5 font-medium">{l.payee_display}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{basisLabel(l)}</td>
                  <td className="px-4 py-2.5 font-mono text-right whitespace-nowrap">{money(l.amount, l.currency)}</td>
                  <td className="px-4 py-2.5 w-28">{statusBadge(l.status)}</td>
                  <td className="px-4 py-2.5 w-24 text-right">
                    {l.status === "due" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act.mutate({ id: l.id, action: "approve" })}>
                        {t("settlement.btn_approve")}
                      </Button>
                    )}
                    {l.status === "approved" && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => act.mutate({ id: l.id, action: "pay" })}>
                        <Check className="w-3 h-3 mr-1" /> {t("settlement.btn_pay")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t">
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{t("settlement.retained")}</td>
                <td colSpan={2} className="px-4 py-2.5 text-xs text-muted-foreground">{t("settlement.retained_desc")}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-right whitespace-nowrap">{money(r.retained, r.currency)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </ExportableTable>
        </div>
      ))}

      {/* ── Term dialog ─────────────────────────────────────────────── */}
      <Dialog open={termOpen} onOpenChange={setTermOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("settlement.edit_term") : t("settlement.add_term")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("settlement.col_party")}</Label>
              <Select value={form.party_type} onValueChange={(v) => setForm((f) => ({ ...f, party_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTY_TYPES.map((p) => <SelectItem key={p} value={p}>{t(`settlement.party_${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("settlement.col_payee")}</Label>
              <AccountLookupSelect
                value={form.payee_account_id}
                onChange={(id) => setForm((f) => ({ ...f, payee_account_id: id }))}
                lookupUrl="/api/v1/lookup/accounts"
                displayValue={editing?.payee_name ?? null}
              />
              {/* Free-text fallback: a payout to someone with no CRM account is
                  still allowed, but it must carry a name or it can't be audited. */}
              <Input
                className="mt-1.5"
                placeholder={t("settlement.payee_name_placeholder")}
                value={form.payee_name}
                onChange={(e) => setForm((f) => ({ ...f, payee_name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">{t("settlement.col_basis")}</Label>
              <Select value={form.basis} onValueChange={(v) => setForm((f) => ({ ...f, basis: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BASES.map((b) => <SelectItem key={b} value={b}>{t(`settlement.basis_${b}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.basis === "percent_of_rent" ? (
              <div>
                <Label className="text-xs">{t("settlement.rate_label")}</Label>
                <Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
                <p className="text-xs text-muted-foreground mt-1">{t("settlement.rate_hint")}</p>
              </div>
            ) : (
              <div>
                <Label className="text-xs">{t("common.amount")}</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            )}
            <div>
              <Label className="text-xs">{t("settlement.col_cadence")}</Label>
              <Select value={form.cadence} onValueChange={(v) => setForm((f) => ({ ...f, cadence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CADENCES.map((c) => <SelectItem key={c} value={c}>{t(`settlement.cadence_${c}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.cadence === "once" && <p className="text-xs text-muted-foreground mt-1">{t("settlement.cadence_once_hint")}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveTerm.mutate()} disabled={saveTerm.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
