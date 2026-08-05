import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Check, Link2, X, CheckCircle2, AlertTriangle, Landmark } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
// 은행 대사 — import statement lines, match them to the ledger, and see whether
// the two actually agree.
//
// The reconciliation summary is the point of the screen: "0 unmatched" alone is
// not proof, because a balance gap can survive with every line matched. Both
// conditions have to hold before it reports clean.

type BankAccount = { id: number; name: string; bank_name: string | null; currency: string; gl_account_code: string; statement_balance: string | null };
type Txn = { id: number; txn_date: string; description: string; amount: string; reference: string | null; status: string; matched_entry_id: number | null };
type Recon = { statement_balance: number | null; gl_balance: number; difference: number | null; unmatched_count: number; reconciled_count: number; fully_reconciled: boolean; currency: string };
type Suggestion = { entry_id: number; entry_date: string; description: string; cash_delta: number };

/** Minimal CSV reader: date, description, amount[, balance][, reference]. */
function parseCsv(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const looksLikeHeader = !/^\d{4}-\d{2}-\d{2}/.test(lines[0]!);
  return lines.slice(looksLikeHeader ? 1 : 0).map((line) => {
    const c = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    return {
      txn_date: c[0] ?? "",
      description: c[1] ?? "",
      // Strip thousands separators and currency symbols before parsing.
      amount: Number((c[2] ?? "0").replace(/[^\d.-]/g, "")),
      balance: c[3] ? Number(c[3].replace(/[^\d.-]/g, "")) : null,
      reference: c[4] || null,
    };
  }).filter((r) => r.txn_date && Number.isFinite(r.amount));
}

export default function BankReconciliation() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = useBrand();
  const fileRef = useRef<HTMLInputElement>(null);
  const [acctId, setAcctId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("unmatched");
  const [matchFor, setMatchFor] = useState<Txn | null>(null);
  const [counterCode, setCounterCode] = useState("");

  const { data: acctData } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await apiFetch("/api/v1/bank-accounts")).json(),
  });
  const accounts: BankAccount[] = acctData?.data ?? [];
  const active = acctId ?? accounts[0]?.id ?? null;
  const activeAcct = accounts.find((a) => a.id === active);
  const money = (v: unknown) => formatMoney(Number(v ?? 0), activeAcct?.currency || brand.currency || "KRW", brand.currencyPosition);

  const { data: txnData } = useQuery({
    queryKey: ["bank-txns", active, statusFilter],
    queryFn: async () => (await apiFetch(`/api/v1/bank-transactions?bank_account_id=${active}${statusFilter ? `&status=${statusFilter}` : ""}`)).json(),
    enabled: !!active,
  });
  const { data: reconData } = useQuery({
    queryKey: ["bank-recon", active],
    queryFn: async () => (await apiFetch(`/api/v1/bank-accounts/${active}/reconciliation`)).json(),
    enabled: !!active,
  });
  const { data: coaData } = useQuery({
    queryKey: ["coa"],
    queryFn: async () => (await apiFetch("/api/v1/chart-of-accounts")).json(),
  });

  const txns: Txn[] = txnData?.data ?? [];
  const recon: Recon | null = reconData?.data ?? null;
  const coa: { code: string; name: string }[] = coaData?.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bank-txns"] });
    qc.invalidateQueries({ queryKey: ["bank-recon"] });
  };

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error(t("bank.csv_empty"));
      const r = await apiFetch(`/api/v1/bank-accounts/${active}/import`, {
        method: "POST",
        body: JSON.stringify({ rows }),
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      return (await r.json()).data as { imported: number; skipped: number; total: number };
    },
    onSuccess: (d) => {
      refresh();
      // Always surface skips — they are the operator's only signal that the file
      // overlapped a previous import.
      toast({
        title: t("bank.import_done", { count: d.imported }),
        description: d.skipped ? t("bank.import_skipped", { count: d.skipped }) : undefined,
      });
    },
    onError: (e: Error) => toast({ title: t("bank.import_failed"), description: e.message, variant: "destructive" }),
  });

  const { data: sugData } = useQuery({
    queryKey: ["bank-suggestions", matchFor?.id],
    queryFn: async () => (await apiFetch(`/api/v1/bank-transactions/${matchFor!.id}/match-suggestions`)).json(),
    enabled: !!matchFor,
  });
  const suggestions: Suggestion[] = sugData?.data?.suggestions ?? [];

  const act = useMutation({
    mutationFn: async ({ id, action, body }: { id: number; action: string; body?: unknown }) => {
      const r = await apiFetch(`/api/v1/bank-transactions/${id}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { "Content-Type": "application/json" } : undefined,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      return r.json();
    },
    onSuccess: () => { setMatchFor(null); setCounterCode(""); refresh(); toast({ title: t("bank.updated") }); },
    onError: (e: Error) => toast({ title: t("bank.action_failed"), description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t("bank.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("bank.desc")}</p>
          </div>
          <div className="flex items-center gap-2">
            {accounts.length > 0 && (
              <Select value={String(active ?? "")} onValueChange={(v) => setAcctId(Number(v))}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.bank_name ? ` · ${a.bank_name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ""; }}
            />
            <Button size="sm" variant="outline" disabled={!active || importCsv.isPending} onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" /> {t("bank.btn_import")}
            </Button>
          </div>
        </div>

        {!accounts.length ? (
          <div className="rounded-lg border bg-white py-12 text-center text-muted-foreground text-sm">
            <Landmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {t("bank.no_accounts")}
          </div>
        ) : (
          <>
            {recon && (
              <div className={`rounded-lg border px-4 py-3 ${recon.fully_reconciled ? "border-green-300 bg-green-50" : "bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {recon.fully_reconciled ? (
                      <><CheckCircle2 className="w-4 h-4 text-green-600" /> {t("bank.reconciled_clean")}</>
                    ) : (
                      <><AlertTriangle className="w-4 h-4 text-amber-600" /> {t("bank.reconciled_pending")}</>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("bank.statement_balance")}</div>
                      <div className="font-mono">{recon.statement_balance != null ? money(recon.statement_balance) : "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("bank.gl_balance")}</div>
                      <div className="font-mono">{money(recon.gl_balance)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("bank.difference")}</div>
                      <div className={`font-mono font-bold ${recon.difference && Math.abs(recon.difference) >= 0.01 ? "text-red-600" : ""}`}>
                        {recon.difference != null ? money(recon.difference) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("bank.unmatched")}</div>
                      <div className="font-mono font-bold">{recon.unmatched_count}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-1">
              {["unmatched", "reconciled", "ignored", ""].map((s) => (
                <Button key={s || "all"} size="sm" variant={statusFilter === s ? "default" : "outline"} className="h-7 text-xs" onClick={() => setStatusFilter(s)}>
                  {s ? t(`bank.status_${s}`) : t("common.all")}
                </Button>
              ))}
            </div>

            <div className="rounded-lg border bg-white overflow-x-auto">
              <ExportableTable fileName="bank-reconciliation" className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[t("bank.col_date"), t("bank.col_description"), t("bank.col_reference"), t("common.amount"), t("common.status"), ""].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!txns.length ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">{t("bank.no_lines")}</td></tr>
                  ) : txns.map((tx) => {
                    const amt = Number(tx.amount);
                    return (
                      <tr key={tx.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(tx.txn_date)}</td>
                        <td className="px-4 py-2.5">{tx.description}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{tx.reference || "—"}</td>
                        {/* Sign carries the meaning — colour makes in/out scannable. */}
                        <td className={`px-4 py-2.5 font-mono text-right whitespace-nowrap ${amt < 0 ? "text-red-600" : "text-green-700"}`}>
                          {money(amt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={
                            tx.status === "reconciled" ? "bg-green-50 text-green-700 border-green-200"
                            : tx.status === "ignored" ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"}>
                            {t(`bank.status_${tx.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {tx.status === "unmatched" ? (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMatchFor(tx)}>
                                <Link2 className="w-3 h-3 mr-1" /> {t("bank.btn_match")}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => act.mutate({ id: tx.id, action: "ignore" })}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act.mutate({ id: tx.id, action: "unmatch" })}>
                              {t("bank.btn_unmatch")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ExportableTable>
            </div>
          </>
        )}

        {/* ── Match dialog ─────────────────────────────────────────────── */}
        <Dialog open={!!matchFor} onOpenChange={(o) => { if (!o) { setMatchFor(null); setCounterCode(""); } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{t("bank.match_title")}</DialogTitle></DialogHeader>
            {matchFor && (
              <div className="space-y-4">
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span>{matchFor.description}</span>
                    <span className="font-mono font-medium">{money(matchFor.amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDate(matchFor.txn_date)}</div>
                </div>

                <div>
                  <Label className="text-xs">{t("bank.suggestions_label")}</Label>
                  {!suggestions.length ? (
                    <p className="text-xs text-muted-foreground mt-1.5">{t("bank.no_suggestions")}</p>
                  ) : (
                    <div className="mt-1.5 space-y-1">
                      {suggestions.map((s) => (
                        <button
                          key={s.entry_id}
                          className="w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => act.mutate({ id: matchFor.id, action: "match", body: { entry_id: s.entry_id } })}
                        >
                          <div className="flex justify-between">
                            <span>{s.description}</span>
                            <span className="font-mono">{money(s.cash_delta)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDate(s.entry_date)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nothing in the ledger explains this line — book it (bank fee,
                    interest, an unrecorded transfer) and reconcile in one step. */}
                <div className="border-t pt-3">
                  <Label className="text-xs">{t("bank.create_entry_label")}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{t("bank.create_entry_hint")}</p>
                  <div className="flex gap-2">
                    <Select value={counterCode} onValueChange={setCounterCode}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={t("bank.counter_account")} /></SelectTrigger>
                      <SelectContent>
                        {coa.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!counterCode || act.isPending}
                      onClick={() => act.mutate({ id: matchFor.id, action: "create-entry", body: { counter_account_code: counterCode } })}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> {t("bank.btn_create_entry")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setMatchFor(null); setCounterCode(""); }}>{t("common.cancel")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
