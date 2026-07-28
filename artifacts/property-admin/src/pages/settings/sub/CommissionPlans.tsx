import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { apiJson } from "@/lib/apiFetch";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { Button } from "@/components/ui/button";
import { Percent, Plus, Trash2 } from "lucide-react";

// Admin management of agent commission plans (per-agent rate + base). The base
// determines what percentage_rate applies to — upfront payment, one month's rent,
// or the Korean 환산보증금 (deposit + rent×100). See lib/homestay/commission.ts.
type Plan = {
  id: number; account_id: number; agent_name: string | null; name: string | null;
  fixed_referral_fee: string; percentage_rate: string; stack: boolean; base_type: string; status: string;
};
const BASE_TYPES = ["upfront", "monthly", "converted"];

export default function CommissionPlansPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery<{ data: Plan[] }>({ queryKey: ["commission-plans"], queryFn: () => apiJson("/api/v1/homestay-commission-plans") });
  const plans = data?.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["commission-plans"] });

  const [creating, setCreating] = useState(false);

  const del = useMutation({
    mutationFn: (id: number) => apiJson(`/api/v1/homestay-commission-plans/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Layout>
      <PageHeader
        title={<><Percent className="h-5 w-5" />{t("commission_plans.title", "Commission Plans")}</>}
        subtitle={t("commission_plans.subtitle", "Per-agent referral fee & rate. The base sets what the percentage applies to.")}
      />
      <div className="px-8 py-6 space-y-4 max-w-3xl">
        {!creating && <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5 mr-1" /> {t("commission_plans.add", "New plan")}</Button>}
        {creating && <PlanForm onDone={() => { setCreating(false); invalidate(); }} onCancel={() => setCreating(false)} />}

        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["agent", "base", "rate", "fixed", "stack", "status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{h ? t(`commission_plans.col_${h}`, h) : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.no_data", "No plans yet")}</td></tr>
              ) : plans.map((p) => (
                <PlanRow key={p.id} plan={p} onChanged={invalidate} onDelete={() => del.mutate(p.id)} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function baseLabel(t: any, base: string) { return t(`commission_plans.base_${base}`, base); }

function PlanRow({ plan, onChanged, onDelete, t }: { plan: Plan; onChanged: () => void; onDelete: () => void; t: any }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <tr><td colSpan={7} className="p-3 bg-gray-50"><PlanForm plan={plan} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} /></td></tr>;
  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="px-4 py-2.5 font-medium">{plan.agent_name ?? `#${plan.account_id}`}{plan.name ? <span className="text-muted-foreground"> · {plan.name}</span> : null}</td>
      <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{baseLabel(t, plan.base_type)}</span></td>
      <td className="px-4 py-2.5">{Number(plan.percentage_rate)}%</td>
      <td className="px-4 py-2.5">{Number(plan.fixed_referral_fee).toLocaleString()}</td>
      <td className="px-4 py-2.5">{plan.stack ? "✓" : "—"}</td>
      <td className="px-4 py-2.5">{plan.status}</td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <button className="text-primary hover:underline text-xs mr-3" onClick={() => setEditing(true)}>{t("common.edit", "Edit")}</button>
        <button className="text-red-600 hover:text-red-700" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 inline" /></button>
      </td>
    </tr>
  );
}

function PlanForm({ plan, onDone, onCancel }: { plan?: Plan; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState<number | null>(plan?.account_id ?? null);
  const [baseType, setBaseType] = useState(plan?.base_type ?? "upfront");
  const [rate, setRate] = useState(plan ? String(Number(plan.percentage_rate)) : "");
  const [fixed, setFixed] = useState(plan ? String(Number(plan.fixed_referral_fee)) : "");
  const [stack, setStack] = useState(plan?.stack ?? true);

  const save = useMutation({
    mutationFn: () => {
      const body = { account_id: accountId, base_type: baseType, percentage_rate: Number(rate) || 0, fixed_referral_fee: Number(fixed) || 0, stack };
      return plan
        ? apiJson(`/api/v1/homestay-commission-plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiJson(`/api/v1/homestay-commission-plans`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: onDone,
  });

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("commission_plans.col_agent", "Agent")}</label>
          <AccountLookupSelect value={accountId} onChange={setAccountId} lookupUrl="/api/v1/lookup/accounts?type=Agent" displayValue={plan?.agent_name} placeholder={t("commission_plans.pick_agent", "Search agent…")} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("commission_plans.col_base", "Base")}</label>
          <select value={baseType} onChange={(e) => setBaseType(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
            {BASE_TYPES.map((b) => <option key={b} value={b}>{t(`commission_plans.base_${b}`, b)}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">{t(`commission_plans.hint_${baseType}`, "")}</p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("commission_plans.col_rate", "Rate")} %</label>
          <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className="border rounded px-2 py-2 text-sm w-full" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">{t("commission_plans.col_fixed", "Fixed fee")}</label>
          <input type="number" step="0.01" min="0" value={fixed} onChange={(e) => setFixed(e.target.value)} className="border rounded px-2 py-2 text-sm w-full" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={stack} onChange={(e) => setStack(e.target.checked)} />
        {t("commission_plans.stack_label", "Apply fixed + percentage together (stack)")}
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={!accountId || save.isPending} onClick={() => save.mutate()}>{t("common.save", "Save")}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel", "Cancel")}</Button>
      </div>
    </div>
  );
}
