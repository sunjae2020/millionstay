import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";

type GlLine = {
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
};

type GlEntry = {
  id: number;
  posting_key: string;
  entry_date: string;
  description: string;
  source_type: string;
  source_id: number | string | null;
  currency: string;
  lines: GlLine[];
};

type TrialBalanceRow = {
  account_code: string;
  account_name: string;
  debit_total: string;
  credit_total: string;
  balance: string;
};

function fmt(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function fetchEntries(from: string, to: string): Promise<{ data: GlEntry[] }> {
  const res = await apiFetch(`/api/v1/gl/entries${buildQuery(from, to)}`);
  if (!res.ok) throw new Error("Failed to fetch journal entries");
  return res.json();
}

async function fetchTrialBalance(
  from: string,
  to: string,
): Promise<{ data: TrialBalanceRow[]; totals: { debit: string; credit: string } }> {
  const res = await apiFetch(`/api/v1/gl/trial-balance${buildQuery(from, to)}`);
  if (!res.ok) throw new Error("Failed to fetch trial balance");
  return res.json();
}

export default function Journal() {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: entriesResp } = useQuery({
    queryKey: ["gl-entries", from, to],
    queryFn: () => fetchEntries(from, to),
  });
  const { data: tbResp } = useQuery({
    queryKey: ["gl-trial-balance", from, to],
    queryFn: () => fetchTrialBalance(from, to),
  });

  const entries = entriesResp?.data ?? [];
  const trialBalance = tbResp?.data ?? [];
  const totals = tbResp?.totals ?? { debit: "0", credit: "0" };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("journal.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("journal.subtitle")}</p>
        </div>

        {/* Date range filter */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("journal.filter_from")}</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t("journal.filter_to")}</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        {/* Trial balance card */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">{t("journal.trial_balance")}</h2>
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("journal.col_account")}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("journal.col_description")}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("journal.col_debit")}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("journal.col_credit")}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("journal.col_balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("journal.empty")}</td>
                    </tr>
                  )}
                  {trialBalance.map((row) => (
                    <tr key={row.account_code} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{row.account_code}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.account_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(row.debit_total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(row.credit_total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                {trialBalance.length > 0 && (
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td className="px-4 py-3 font-semibold" colSpan={2}>{t("journal.col_total")}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(totals.debit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(totals.credit)}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Journal entries list */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("journal.journal_entries")}</h2>
          {entries.length === 0 ? (
            <div className="border rounded-lg bg-white px-4 py-8 text-center text-muted-foreground text-sm">
              {t("journal.empty")}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {entries.map((entry) => (
                <div key={entry.id} className="border rounded-lg overflow-hidden bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-muted/20">
                    <div>
                      <div className="font-medium">{entry.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.entry_date}
                        {" · "}
                        {t("journal.source")}: {entry.source_type}
                        {entry.source_id != null ? ` #${entry.source_id}` : ""}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{entry.currency}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max text-sm">
                      <thead className="border-b bg-muted/10">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("journal.col_account")}</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("journal.col_debit")}</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">{t("journal.col_credit")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line, idx) => (
                          <tr key={`${entry.id}-${idx}`} className="border-b last:border-0">
                            <td className="px-4 py-2">
                              <span className="font-medium">{line.account_code}</span>
                              <span className="text-muted-foreground"> — {line.account_name}</span>
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {Number(line.debit) ? fmt(line.debit) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {Number(line.credit) ? fmt(line.credit) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
