import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { apiJson } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, Trash2 } from "lucide-react";

// Admin management of the rental commission fee RATE CARD (임대 수수료 기준표).
// Per property TYPE: 중개수수료(부동산, +간이과세) / 자체수수료(자체 관리자, −원천징수) /
// Working(직접 모객). This is the rule set; actual paid amounts are recorded per contract
// under the "Related Costs" tab. See lib/db schema rental_fee_schedules.
type Schedule = {
  id: number;
  type_label: string;
  brokerage_fee: number;
  self_fee: number;
  working_fee: number;
  brokerage_surcharge_rate: number;
  self_withholding_rate: number;
  currency: string;
  sort_order: number;
  note: string;
  status: string;
};

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n.toLocaleString()} ${currency}`;
  }
};

// 간이과세 가산 후 실제 지급 중개수수료
const brokeragePayable = (s: Schedule) => Math.round(s.brokerage_fee * (1 + s.brokerage_surcharge_rate / 100));
// 원천징수 차감 후 실지급 자체수수료
const selfPayable = (s: Schedule) => Math.round(s.self_fee * (1 - s.self_withholding_rate / 100));

export default function RentalFeeSchedulesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery<{ data: Schedule[] }>({
    queryKey: ["rental-fee-schedules"],
    queryFn: () => apiJson("/api/v1/rental-fee-schedules"),
  });
  const rows = data?.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rental-fee-schedules"] });

  const [creating, setCreating] = useState(false);

  const del = useMutation({
    mutationFn: (id: number) => apiJson(`/api/v1/rental-fee-schedules/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const seed = useMutation({
    mutationFn: () => apiJson(`/api/v1/rental-fee-schedules/seed-defaults`, { method: "POST" }),
    onSuccess: invalidate,
  });

  return (
    <Layout>
      <PageHeader
        title={<><Wallet className="h-5 w-5" />{t("rental_fees.title", "Rental Fee Schedule")}</>}
        subtitle={t("rental_fees.subtitle", "Per-type brokerage & self-management commission rate card used when a unit is rented.")}
      />
      <div className="px-8 py-6 space-y-4 max-w-6xl">
        <div className="flex flex-wrap gap-2">
          {!creating && (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t("rental_fees.add", "New type")}
            </Button>
          )}
          {rows.length === 0 && (
            <Button size="sm" variant="ghost" disabled={seed.isPending} onClick={() => seed.mutate()}>
              {t("rental_fees.seed", "Load default table (A,B / C / D / E)")}
            </Button>
          )}
        </div>

        {creating && <ScheduleForm onDone={() => { setCreating(false); invalidate(); }} onCancel={() => setCreating(false)} />}

        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["type", "brokerage", "self", "working", "status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    {h ? t(`rental_fees.col_${h}`, h) : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.no_data", "No fee types yet")}</td></tr>
              ) : rows.map((s) => (
                <ScheduleRow key={s.id} row={s} onChanged={invalidate} onDelete={() => del.mutate(s.id)} t={t} />
              ))}
            </tbody>
          </table>
        </div>

        <Reconciliation />

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("rental_fees.footnote", "Brokerage shows the base amount plus the 간이과세 surcharge actually paid; self-management shows the base amount net of 원천징수 withholding. Working is the flat self fee when the customer is sourced directly (no external agent).")}
        </p>
      </div>
    </Layout>
  );
}

function ScheduleRow({ row, onChanged, onDelete, t }: { row: Schedule; onChanged: () => void; onDelete: () => void; t: any }) {
  const [editing, setEditing] = useState(false);
  if (editing) return (
    <tr><td colSpan={6} className="p-3 bg-gray-50"><ScheduleForm row={row} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} /></td></tr>
  );
  return (
    <tr className="border-b last:border-0 hover:bg-gray-50 align-top">
      <td className="px-4 py-2.5 font-medium">{row.type_label}</td>
      <td className="px-4 py-2.5">
        {money(row.brokerage_fee, row.currency)}
        <span className="block text-[11px] text-muted-foreground">
          +{row.brokerage_surcharge_rate}% → {money(brokeragePayable(row), row.currency)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {money(row.self_fee, row.currency)}
        <span className="block text-[11px] text-muted-foreground">
          −{row.self_withholding_rate}% → {money(selfPayable(row), row.currency)}
        </span>
      </td>
      <td className="px-4 py-2.5">{money(row.working_fee, row.currency)}</td>
      <td className="px-4 py-2.5">{row.status}</td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <button className="text-primary hover:underline text-xs mr-3" onClick={() => setEditing(true)}>{t("common.edit", "Edit")}</button>
        <button className="text-red-600 hover:text-red-700" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 inline" /></button>
      </td>
    </tr>
  );
}

// 대사(Reconciliation): rate card vs the amounts actually recorded on each contract
// under 관련 비용. Highlights over/under payments and contracts whose unit type has
// no matching rate-card row.
type ReconRow = {
  contract_id: number; contract_ref: string; status: string; start_date: string | null;
  tenant_name: string | null; unit_name: string | null; unit_type: string | null;
  currency: string; type_label: string | null;
  expected: number | null; lease_fee: number; agency_fee: number; actual: number; diff: number | null;
};

function Reconciliation() {
  const { t } = useTranslation();
  const [basis, setBasis] = useState<"brokerage" | "self" | "working">("brokerage");
  const [onlyMismatch, setOnlyMismatch] = useState(true);
  const { data } = useQuery<{ basis: string; total_expected: number; total_actual: number; mismatched: number; unmatched_type: number; data: ReconRow[] }>({
    queryKey: ["rental-fee-reconciliation", basis],
    queryFn: () => apiJson(`/api/v1/rental-fee-schedules/reconciliation?basis=${basis}`),
  });
  const all = data?.data ?? [];
  const rows = onlyMismatch ? all.filter((r) => r.diff == null || r.diff !== 0) : all;
  const currency = all[0]?.currency ?? "KRW";

  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("rental_fees.recon_title", "Fee reconciliation")}</h3>
          <p className="text-xs text-muted-foreground">{t("rental_fees.recon_desc", "Rate card vs the fees actually recorded on each contract.")}</p>
        </div>
        <div className="flex items-center gap-1">
          {(["brokerage", "self", "working"] as const).map((b) => (
            <Button key={b} size="sm" variant={basis === b ? "default" : "outline"} onClick={() => setBasis(b)}>
              {t(`rental_fees.col_${b}`, b)}
            </Button>
          ))}
          <Button size="sm" variant={onlyMismatch ? "default" : "outline"} onClick={() => setOnlyMismatch((v) => !v)}>
            {t("rental_fees.recon_only_diff", "Differences only")}
          </Button>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>{t("rental_fees.recon_expected", "Expected")}: <strong className="text-foreground">{money(data.total_expected, currency)}</strong></span>
          <span>{t("rental_fees.recon_actual", "Actual")}: <strong className="text-foreground">{money(data.total_actual, currency)}</strong></span>
          <span>{t("rental_fees.recon_mismatch", "Mismatched")}: <strong className="text-foreground">{data.mismatched}</strong></span>
          {data.unmatched_type > 0 && (
            <span className="text-amber-600">{t("rental_fees.recon_no_rate", "No rate-card row")}: <strong>{data.unmatched_type}</strong></span>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {[
                t("rental_fees.recon_contract", "Contract"), t("rental_fees.recon_tenant", "Tenant"),
                t("rental_fees.recon_unit", "Unit"), t("rental_fees.col_type", "Type"),
                t("rental_fees.recon_expected", "Expected"), t("rental_fees.recon_lease_fee", "임대수수료"),
                t("rental_fees.recon_agency_fee", "부동산수수료"), t("rental_fees.recon_actual", "Actual"),
                t("rental_fees.recon_diff", "Difference"),
              ].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">{t("rental_fees.recon_empty", "Nothing to reconcile")}</td></tr>
            ) : rows.slice(0, 100).map((r) => (
              <tr key={r.contract_id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <a className="text-primary hover:underline" href={`/contracts/${r.contract_id}`}>{r.contract_ref}</a>
                </td>
                <td className="px-4 py-2.5">{r.tenant_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.unit_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.unit_type ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono">{r.expected == null ? "—" : money(r.expected, r.currency)}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">{money(r.lease_fee, r.currency)}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">{money(r.agency_fee, r.currency)}</td>
                <td className="px-4 py-2.5 font-mono">{money(r.actual, r.currency)}</td>
                <td className={`px-4 py-2.5 font-mono font-medium ${r.diff == null ? "text-amber-600" : r.diff === 0 ? "text-muted-foreground" : r.diff > 0 ? "text-red-600" : "text-blue-600"}`}>
                  {r.diff == null ? t("rental_fees.recon_no_rate", "No rate-card row") : `${r.diff > 0 ? "+" : ""}${money(r.diff, r.currency)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 100 && <p className="text-[11px] text-muted-foreground">{t("rental_fees.recon_truncated", "Showing the first 100 rows.")}</p>}
    </div>
  );
}

function ScheduleForm({ row, onDone, onCancel }: { row?: Schedule; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [typeLabel, setTypeLabel] = useState(row?.type_label ?? "");
  const [brokerage, setBrokerage] = useState(row ? String(row.brokerage_fee) : "");
  const [self, setSelf] = useState(row ? String(row.self_fee) : "");
  const [working, setWorking] = useState(row ? String(row.working_fee) : "");
  const [surcharge, setSurcharge] = useState(row ? String(row.brokerage_surcharge_rate) : "4");
  const [withholding, setWithholding] = useState(row ? String(row.self_withholding_rate) : "3.3");
  const [currency, setCurrency] = useState(row?.currency ?? "KRW");
  const [note, setNote] = useState(row?.note ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body = {
        type_label: typeLabel.trim(),
        brokerage_fee: Number(brokerage) || 0,
        self_fee: Number(self) || 0,
        working_fee: Number(working) || 0,
        brokerage_surcharge_rate: Number(surcharge) || 0,
        self_withholding_rate: Number(withholding) || 0,
        currency: currency.trim() || "KRW",
        note,
      };
      return row
        ? apiJson(`/api/v1/rental-fee-schedules/${row.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiJson(`/api/v1/rental-fee-schedules`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: onDone,
  });

  const field = (label: string, value: string, setter: (v: string) => void, step = "1") => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input type="number" step={step} min="0" value={value} onChange={(e) => setter(e.target.value)} className="border rounded px-2 py-2 text-sm w-full" />
    </div>
  );

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("rental_fees.col_type", "Type")}</label>
          <input value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} placeholder="A,B" className="border rounded px-2 py-2 text-sm w-full" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("rental_fees.currency", "Currency")}</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="border rounded px-2 py-2 text-sm w-full" />
        </div>
        <div />
        {field(t("rental_fees.col_brokerage", "Brokerage fee"), brokerage, setBrokerage)}
        {field(t("rental_fees.col_self", "Self-management fee"), self, setSelf)}
        {field(t("rental_fees.col_working", "Working fee"), working, setWorking)}
        {field(t("rental_fees.surcharge", "Brokerage surcharge %"), surcharge, setSurcharge, "0.01")}
        {field(t("rental_fees.withholding", "Self withholding %"), withholding, setWithholding, "0.01")}
        <div />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">{t("rental_fees.note", "Note")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="border rounded px-2 py-2 text-sm w-full" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!typeLabel.trim() || save.isPending} onClick={() => save.mutate()}>{t("common.save", "Save")}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel", "Cancel")}</Button>
      </div>
    </div>
  );
}
