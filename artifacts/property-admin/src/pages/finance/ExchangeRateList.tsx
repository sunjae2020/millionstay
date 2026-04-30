import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Plus, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

type ExchangeRate = {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: string;
  source: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
};

const SUPPORTED = [
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "KRW", label: "KRW — Korean Won" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "THB", label: "THB — Thai Baht" },
  { code: "PHP", label: "PHP — Philippine Peso" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
];

async function fetchRates(): Promise<{ data: ExchangeRate[] }> {
  const res = await apiFetch("/api/v1/exchange-rates");
  if (!res.ok) throw new Error("Failed to fetch rates");
  return res.json();
}

async function fetchSyncInfo() {
  const res = await apiFetch("/api/v1/exchange-rates/sync-info");
  if (!res.ok) throw new Error("Failed to fetch sync info");
  return res.json() as Promise<{ data: { last_sync_at: string | null; last_effective_date: string | null; tracked_count: number } }>;
}

async function createRate(body: { from_currency: string; to_currency: string; rate: string }) {
  const res = await apiFetch("/api/v1/exchange-rates", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error?.message ?? "Failed to create");
  return res.json();
}

async function deleteRate(id: number) {
  const res = await apiFetch(`/api/v1/exchange-rates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
  return res.json();
}

async function triggerSync() {
  const res = await apiFetch("/api/v1/exchange-rates/sync", { method: "POST" });
  if (!res.ok) throw new Error("Sync failed");
  return res.json() as Promise<{ data: { ok: boolean; updated: string[]; skipped: string[]; error?: string } }>;
}

function fmt(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function ExchangeRateList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [from, setFrom] = useState("KRW");
  const [rate, setRate] = useState("");

  const ratesQ = useQuery({ queryKey: ["exchange-rates"], queryFn: fetchRates });
  const syncInfoQ = useQuery({ queryKey: ["exchange-rates", "sync-info"], queryFn: fetchSyncInfo });

  const createMut = useMutation({
    mutationFn: createRate,
    onSuccess: () => {
      toast({ title: "Currency pair added" });
      setRate("");
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteRate,
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  const syncMut = useMutation({
    mutationFn: triggerSync,
    onSuccess: (r) => {
      const d = r.data;
      if (d.ok) {
        toast({ title: "Sync complete", description: `Updated: ${d.updated.join(", ") || "none"}${d.skipped.length ? ` · Skipped: ${d.skipped.join(", ")}` : ""}` });
      } else {
        toast({ title: "Sync failed", description: d.error ?? "unknown error", variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  const rows = ratesQ.data?.data ?? [];
  const info = syncInfoQ.data?.data;

  return (
    <Layout>
      <PageHeader
        title="Exchange Rates"
        subtitle="Manage currency pairs used across product pricing and customer-facing display. AUD is the base currency."
      />

      <div className="rounded-lg border bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-muted-foreground">Last auto sync</div>
            <div className="font-medium">{fmt(info?.last_sync_at ?? null)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Tracked currencies: {info?.tracked_count ?? 0} · Provider: open.er-api.com (free, AUD base)
            </div>
          </div>
          <Button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            variant="outline"
          >
            {syncMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Now
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 mb-4">
        <div className="text-sm font-medium mb-3">Add / Update Currency Pair (vs AUD)</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">From</label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED.filter((c) => c.code !== "AUD").map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Rate (1 {from} = ? AUD)</label>
            <Input
              type="number"
              step="0.00000001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 0.00115"
              className="w-56"
            />
          </div>
          <Button
            onClick={() => {
              if (!rate || Number(rate) <= 0) {
                toast({ title: "Enter a positive rate", variant: "destructive" });
                return;
              }
              createMut.mutate({ from_currency: from, to_currency: "AUD", rate });
            }}
            disabled={createMut.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Save
          </Button>
          <div className="text-xs text-muted-foreground ml-2">
            Tip: registering a pair here marks the currency as "tracked" — daily auto-sync will update it.
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left">From</th>
              <th className="px-4 py-2 text-left">To</th>
              <th className="px-4 py-2 text-right">Rate (1 from = N to)</th>
              <th className="px-4 py-2 text-right">Inverse (1 to = N from)</th>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">Effective Date</th>
              <th className="px-4 py-2 text-left">Updated</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No exchange rates yet — add a currency pair to start auto-sync.</td></tr>
            )}
            {rows.map((r) => {
              const n = Number(r.rate);
              const inv = n > 0 ? 1 / n : 0;
              return (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.from_currency}</td>
                  <td className="px-4 py-2">{r.to_currency}</td>
                  <td className="px-4 py-2 text-right font-mono">{n.toFixed(8)}</td>
                  <td className="px-4 py-2 text-right font-mono">{inv.toFixed(4)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={r.source === "auto" ? "default" : "secondary"}>{r.source}</Badge>
                  </td>
                  <td className="px-4 py-2">{r.effective_date}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{fmt(r.updated_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm("Delete this rate?")) deleteMut.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
