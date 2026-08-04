import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Check, Download, Wallet, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

// Pay Run — the weekly "who do we owe" screen.
//
// Grouped by payee so the routine is "approve this person's four lines at once"
// rather than twenty individual buttons. Groups are keyed by currency too: a
// combined total across currencies is a meaningless number that still looks
// authoritative, so we never produce one.

type Leg = {
  id: number;
  settlement_ref: string;
  party_type: string;
  payee_display: string;
  amount: string;
  currency: string;
  status: string;
  contract_id: number | null;
  basis_snapshot: string | null;
  rate_snapshot: string | null;
};

type Group = {
  payee: string;
  party_type: string;
  currency: string;
  count: number;
  total: number;
  items: Leg[];
};

export default function PayRun() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = useBrand();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["pay-run"],
    queryFn: async () => (await apiFetch("/api/v1/ap/pay-run")).json(),
  });
  const { data: agingData } = useQuery({
    queryKey: ["ap-aging"],
    queryFn: async () => (await apiFetch("/api/v1/ap/aging")).json(),
  });

  const groups: Group[] = data?.data ?? [];
  const aging: { payee: string; currency: string; current: number; d31_60: number; d61_90: number; d90_plus: number; total: number }[] =
    agingData?.data ?? [];
  const overdue = aging.filter((a) => a.d31_60 + a.d61_90 + a.d90_plus > 0);

  const money = (v: unknown, cur: string) => formatMoney(Number(v ?? 0), cur, brand.currencyPosition);

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleGroup = (g: Group) =>
    setSelected((s) => {
      const next = new Set(s);
      const allOn = g.items.every((i) => next.has(i.id));
      for (const i of g.items) allOn ? next.delete(i.id) : next.add(i.id);
      return next;
    });

  /** Run one action across every selected leg, then report what actually moved. */
  const bulk = useMutation({
    mutationFn: async (action: "approve" | "pay") => {
      const ids = [...selected];
      const results = await Promise.all(
        ids.map(async (id) => {
          const r = await apiFetch(`/api/v1/provider-settlements/${id}/${action}`, { method: "POST" });
          return r.ok;
        }),
      );
      return { ok: results.filter(Boolean).length, failed: results.filter((x) => !x).length };
    },
    onSuccess: ({ ok, failed }) => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["pay-run"] });
      qc.invalidateQueries({ queryKey: ["ap-aging"] });
      // A leg in the wrong state is skipped rather than forced, so say so
      // instead of implying everything went through.
      toast({
        title: t("payrun.bulk_done", { count: ok }),
        description: failed ? t("payrun.bulk_skipped", { count: failed }) : undefined,
        variant: failed ? "destructive" : undefined,
      });
    },
  });

  /** Bank-transfer CSV for the selected lines. */
  const exportCsv = () => {
    const rows = groups.flatMap((g) => g.items.filter((i) => selected.has(i.id)));
    if (!rows.length) return;
    const header = ["settlement_ref", "payee", "party_type", "amount", "currency", "status"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [r.settlement_ref, `"${r.payee_display.replace(/"/g, '""')}"`, r.party_type, r.amount, r.currency, r.status].join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pay-run-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedTotal = groups
    .flatMap((g) => g.items)
    .filter((i) => selected.has(i.id))
    .reduce<Record<string, number>>((acc, i) => {
      acc[i.currency] = (acc[i.currency] ?? 0) + Number(i.amount ?? 0);
      return acc;
    }, {});

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t("payrun.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("payrun.desc")}</p>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <div className="text-xs text-muted-foreground">{t("payrun.selected", { count: selected.size })}</div>
                <div className="font-mono text-sm font-bold">
                  {Object.entries(selectedTotal).map(([cur, amt]) => money(amt, cur)).join(" · ")}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="w-3.5 h-3.5 mr-1" /> {t("payrun.btn_csv")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulk.mutate("approve")} disabled={bulk.isPending}>
                {t("payrun.btn_approve_selected")}
              </Button>
              <Button size="sm" onClick={() => bulk.mutate("pay")} disabled={bulk.isPending}>
                <Check className="w-3.5 h-3.5 mr-1" /> {t("payrun.btn_pay_selected")}
              </Button>
            </div>
          )}
        </div>

        {overdue.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertTriangle className="w-4 h-4" /> {t("payrun.aging_warning", { count: overdue.length })}
            </div>
            <div className="mt-2 space-y-1 text-xs text-amber-900">
              {overdue.map((a, i) => (
                <div key={i} className="flex justify-between max-w-lg">
                  <span>{a.payee}</span>
                  <span className="font-mono">
                    {a.d31_60 > 0 && `31–60: ${money(a.d31_60, a.currency)}  `}
                    {a.d61_90 > 0 && `61–90: ${money(a.d61_90, a.currency)}  `}
                    {a.d90_plus > 0 && `90+: ${money(a.d90_plus, a.currency)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border bg-white py-12 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
        ) : !groups.length ? (
          <div className="rounded-lg border bg-white py-12 text-center text-muted-foreground text-sm">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {t("payrun.empty")}
          </div>
        ) : (
          groups.map((g, gi) => (
            <div key={gi} className="rounded-lg border bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={g.items.every((i) => selected.has(i.id))}
                    onCheckedChange={() => toggleGroup(g)}
                  />
                  <div>
                    <div className="font-medium text-sm">{g.payee}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`settlement.party_${g.party_type}`)} · {t("payrun.line_count", { count: g.count })}
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-sm">{money(g.total, g.currency)}</div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {g.items.map((i) => (
                    <tr key={i.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="pl-4 py-2.5 w-10">
                        <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} />
                      </td>
                      <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">{i.settlement_ref}</td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground">
                        {i.basis_snapshot === "percent_of_rent"
                          ? t("settlement.basis_pct_of_rent", { rate: Number(i.rate_snapshot ?? 0) })
                          : i.basis_snapshot
                            ? t(`settlement.basis_${i.basis_snapshot}`)
                            : "—"}
                      </td>
                      <td className="px-2 py-2.5">
                        {i.contract_id && (
                          <Link href={`/contracts/${i.contract_id}`} className="text-xs text-primary hover:underline">
                            {t("payrun.view_contract")}
                          </Link>
                        )}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-right whitespace-nowrap">{money(i.amount, i.currency)}</td>
                      <td className="px-4 py-2.5 w-24 text-right">
                        <Badge variant="outline" className={i.status === "approved" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                          {t(`settlement.status_${i.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
