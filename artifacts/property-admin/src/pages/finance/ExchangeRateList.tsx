import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDate, formatDateTime } from "@/lib/date";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Plus, Loader2, Zap } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";

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
  { code: "AUD", label: "exchange_rate.cur_aud" },
  { code: "USD", label: "exchange_rate.cur_usd" },
  { code: "KRW", label: "exchange_rate.cur_krw" },
  { code: "MYR", label: "exchange_rate.cur_myr" },
  { code: "JPY", label: "exchange_rate.cur_jpy" },
  { code: "CNY", label: "exchange_rate.cur_cny" },
  { code: "THB", label: "exchange_rate.cur_thb" },
  { code: "VND", label: "exchange_rate.cur_vnd" },
  { code: "PHP", label: "exchange_rate.cur_php" },
  { code: "SGD", label: "exchange_rate.cur_sgd" },
  { code: "EUR", label: "exchange_rate.cur_eur" },
  { code: "GBP", label: "exchange_rate.cur_gbp" },
];

async function fetchRates(): Promise<{ data: ExchangeRate[] }> {
  const res = await apiFetch("/api/v1/exchange-rates");
  if (!res.ok) throw new Error("Failed to fetch rates");
  return res.json();
}

type LiveRates = { ok: boolean; error?: string; fetched_at?: string; rates: Record<string, string> };

async function fetchLiveRates(): Promise<{ data: LiveRates }> {
  const res = await apiFetch("/api/v1/exchange-rates/live");
  if (!res.ok) throw new Error("Failed to fetch live rates");
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
  return formatDateTime(d);
}

export default function ExchangeRateList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [from, setFrom] = useState("KRW");
  const [rate, setRate] = useState("");

  const ratesQ = useQuery({ queryKey: ["exchange-rates"], queryFn: fetchRates });
  const syncInfoQ = useQuery({ queryKey: ["exchange-rates", "sync-info"], queryFn: fetchSyncInfo });
  const liveQ = useQuery({ queryKey: ["exchange-rates", "live"], queryFn: fetchLiveRates, staleTime: 60_000 });

  const createMut = useMutation({
    mutationFn: createRate,
    onSuccess: () => {
      toast({ title: t("exchange_rate.toast_pair_added") });
      setRate("");
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
    onError: (e: any) => toast({ title: t("exchange_rate.toast_failed"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteRate,
    onSuccess: () => {
      toast({ title: t("exchange_rate.toast_deleted") });
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  const syncMut = useMutation({
    mutationFn: triggerSync,
    onSuccess: (r) => {
      const d = r.data;
      if (d.ok) {
        toast({
          title: t("exchange_rate.toast_sync_complete"),
          description: t("exchange_rate.toast_sync_updated", { updated: d.updated.join(", ") || t("exchange_rate.none_value") }) + (d.skipped.length ? ` · ${t("exchange_rate.toast_sync_skipped", { skipped: d.skipped.join(", ") })}` : ""),
        });
      } else {
        toast({ title: t("exchange_rate.toast_sync_failed"), description: d.error ?? t("exchange_rate.unknown_error"), variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  const rows = ratesQ.data?.data ?? [];
  const info = syncInfoQ.data?.data;
  const live = liveQ.data?.data;
  const liveRates = live?.rates ?? {};
  const liveOf = (code: string): number | null => {
    const v = liveRates[code];
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  function applyLiveToInput() {
    const v = liveOf(from);
    if (v == null) {
      toast({ title: t("exchange_rate.toast_no_live_rate"), description: t("exchange_rate.toast_no_live_rate_desc", { currency: from }), variant: "destructive" });
      return;
    }
    setRate(v.toFixed(8));
  }

  const columns: ColumnDef<ExchangeRate>[] = useMemo(
    () => [
      {
        key: "from_currency",
        header: "exchange_rate.from",
        hideable: false,
        cell: (r) => <span className="font-medium">{r.from_currency}</span>,
      },
      {
        key: "to_currency",
        header: "exchange_rate.to",
        cell: (r) => <span>{r.to_currency}</span>,
      },
      {
        key: "rate",
        header: "exchange_rate.col_rate",
        align: "right",
        sortAccessor: (r) => Number(r.rate),
        cell: (r) => {
          const n = Number(r.rate);
          return <span className="font-mono">{n.toFixed(8)}</span>;
        },
      },
      {
        key: "inverse",
        header: "exchange_rate.col_inverse",
        align: "right",
        sortAccessor: (r) => {
          const n = Number(r.rate);
          return n > 0 ? 1 / n : 0;
        },
        cell: (r) => {
          const n = Number(r.rate);
          const inv = n > 0 ? 1 / n : 0;
          return <span className="font-mono">{inv.toFixed(4)}</span>;
        },
      },
      {
        key: "live",
        header: "exchange_rate.col_live",
        align: "right",
        sortAccessor: (r) => (r.to_currency === "AUD" ? liveOf(r.from_currency) : null),
        cell: (r) => {
          const liveRate = r.to_currency === "AUD" ? liveOf(r.from_currency) : null;
          return (
            <span className="font-mono text-muted-foreground">
              {liveRate != null ? liveRate.toFixed(8) : "—"}
            </span>
          );
        },
      },
      {
        key: "diff",
        header: "exchange_rate.col_diff",
        align: "right",
        sortAccessor: (r) => {
          const n = Number(r.rate);
          const liveRate = r.to_currency === "AUD" ? liveOf(r.from_currency) : null;
          return liveRate != null && n > 0 ? ((n - liveRate) / liveRate) * 100 : null;
        },
        cell: (r) => {
          const n = Number(r.rate);
          const liveRate = r.to_currency === "AUD" ? liveOf(r.from_currency) : null;
          const diffPct = liveRate != null && n > 0 ? ((n - liveRate) / liveRate) * 100 : null;
          const stale = diffPct != null && Math.abs(diffPct) >= 1;
          return diffPct == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={stale ? "text-amber-600 font-medium" : "text-green-600"}>
              {diffPct > 0 ? "+" : ""}{diffPct.toFixed(2)}%
            </span>
          );
        },
      },
      {
        key: "source",
        header: "exchange_rate.source",
        cell: (r) => <Badge variant={r.source === "auto" ? "default" : "secondary"}>{r.source}</Badge>,
      },
      {
        key: "effective_date",
        header: "exchange_rate.effective_date",
        cell: (r) => <span>{formatDate(r.effective_date)}</span>,
      },
      {
        key: "updated_at",
        header: "common.updated_at",
        sortAccessor: (r) => r.updated_at,
        cell: (r) => <span className="text-xs text-muted-foreground">{fmt(r.updated_at)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        cell: (r) => {
          const n = Number(r.rate);
          const liveRate = r.to_currency === "AUD" ? liveOf(r.from_currency) : null;
          void n;
          return (
            <span className="whitespace-nowrap">
              {liveRate != null && (
                <Button
                  size="sm"
                  variant="ghost"
                  title={t("exchange_rate.update_to_live_tooltip")}
                  disabled={createMut.isPending}
                  onClick={() =>
                    createMut.mutate({ from_currency: r.from_currency, to_currency: "AUD", rate: liveRate.toFixed(8) })
                  }
                >
                  <Zap className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { if (confirm(t("exchange_rate.confirm_delete_rate"))) deleteMut.mutate(r.id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </span>
          );
        },
      },
    ],
    // liveRates drives liveOf; createMut.isPending gates the update-to-live button.
    [t, liveRates, createMut.isPending],
  );

  return (
    <Layout>
      <PageHeader
        title={t("exchange_rate.page_title")}
        subtitle={t("exchange_rate.page_subtitle")}
      />

      <div className="rounded-lg border bg-white p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-muted-foreground">{t("exchange_rate.last_auto_sync")}</div>
            <div className="font-medium">{fmt(info?.last_sync_at ?? null)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("exchange_rate.tracked_currencies", { count: info?.tracked_count ?? 0 })} · {t("exchange_rate.provider_info")}
            </div>
          </div>
          <Button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            variant="outline"
          >
            {syncMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t("exchange_rate.sync_now")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 mb-4">
        <div className="text-sm font-medium mb-3">{t("exchange_rate.add_update_pair")}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{t("exchange_rate.from")}</label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED.filter((c) => c.code !== "AUD").map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} — {t(c.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">{t("exchange_rate.rate_label", { currency: from })}</label>
            <Input
              type="number"
              step="0.00000001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t("exchange_rate.rate_placeholder")}
              className="w-56"
            />
            <div className="text-xs text-muted-foreground mt-1 h-4">
              {liveQ.isLoading
                ? t("exchange_rate.loading_live_rate")
                : liveOf(from) != null
                ? t("exchange_rate.live_rate_hint", { currency: from, rate: liveOf(from)!.toFixed(8) })
                : ""}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={applyLiveToInput}
            disabled={liveQ.isLoading || liveOf(from) == null}
            title={t("exchange_rate.use_live_rate_tooltip")}
          >
            <Zap className="h-4 w-4 mr-2" />
            {t("exchange_rate.use_live_rate")}
          </Button>
          <Button
            onClick={() => {
              if (!rate || Number(rate) <= 0) {
                toast({ title: t("exchange_rate.toast_positive_rate"), variant: "destructive" });
                return;
              }
              createMut.mutate({ from_currency: from, to_currency: "AUD", rate });
            }}
            disabled={createMut.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("common.save")}
          </Button>
          <div className="text-xs text-muted-foreground ml-2">
            {t("exchange_rate.tip_tracked")}
          </div>
        </div>
      </div>

      <DataTable
        tableKey="exchange-rates"
        columns={columns}
        data={rows}
        isLoading={ratesQ.isLoading}
        rowKey={(r) => r.id}
        emptyText={t("exchange_rate.empty_state")}
      />
    </Layout>
  );
}
