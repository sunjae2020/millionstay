import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, addMonths, getDay } from "date-fns";
import { formatDate } from "@/lib/date";
import { Copy, Check, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = { id: number; code: string; name: string };
type Listing = { id: number; channel_id: number; channel_name: string | null };
type Account = { id: number; channel_id: number; label: string; auth_type: string; status: string };
type Reservation = {
  id: number; external_reservation_id: string; booking_id: number | null;
  guest_name: string | null; check_in_date: string; check_out_date: string;
  total_amount: string | null; currency: string | null; reservation_status: string; received_at: string;
};
type RateRow = {
  date: string; rate: string | null; currency: string;
  min_stay: number | null; max_stay: number | null;
  closed_to_arrival: boolean; closed_to_departure: boolean;
};

export function ChannelSyncPanel({ spaceId, channels, listings }: { spaceId: number; channels: Channel[]; listings: Listing[] }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [addAcctChannelId, setAddAcctChannelId] = useState("");
  const [addAcctLabel, setAddAcctLabel] = useState("");
  const [addAcctSecret, setAddAcctSecret] = useState("");
  const [acctBusy, setAcctBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [rateMonth, setRateMonth] = useState<Date>(startOfMonth(new Date()));
  const [rateRows, setRateRows] = useState<RateRow[]>([]);
  const [selDates, setSelDates] = useState<string[]>([]);
  const [rateVal, setRateVal] = useState("");
  const [minStay, setMinStay] = useState("");
  const [maxStay, setMaxStay] = useState("");
  const [cta, setCta] = useState(false);
  const [ctd, setCtd] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);

  const connectedChannelIds = [...new Set(listings.map((l) => l.channel_id))];
  const connectedChannels = channels.filter((c) => connectedChannelIds.includes(c.id));

  const loadAccounts = async () => {
    const all: Account[] = [];
    for (const ch of connectedChannels) {
      try {
        const res = await apiFetch(`/api/v1/channels/${ch.id}/accounts`);
        const j = await res.json();
        if (j.success) all.push(...j.data);
      } catch { /* skip */ }
    }
    setAccounts(all);
  };
  const loadReservations = async () => {
    try {
      const res = await apiFetch(`/api/v1/spaces/${spaceId}/channel-reservations`);
      const j = await res.json();
      if (j.success) setReservations(j.data);
    } catch { /* skip */ }
  };
  const loadRates = async (month: Date) => {
    try {
      const from = format(startOfMonth(month), "yyyy-MM-dd");
      const to = format(endOfMonth(month), "yyyy-MM-dd");
      const res = await apiFetch(`/api/v1/spaces/${spaceId}/rate-calendar?from=${from}&to=${to}`);
      const j = await res.json();
      if (j.success) setRateRows(j.data);
    } catch { /* skip */ }
  };

  useEffect(() => {
    loadAccounts();
    loadReservations();
    loadRates(rateMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  const webhookUrl = (code: string) => `${window.location.origin}/api/v1/channels/${code}/reservations`;
  const copyWebhook = async (code: string) => {
    try {
      await navigator.clipboard.writeText(webhookUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch { /* clipboard blocked */ }
  };

  const addAccount = async () => {
    if (!addAcctChannelId || !addAcctLabel) return;
    setAcctBusy(true);
    try {
      const res = await apiFetch(`/api/v1/channel-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: Number(addAcctChannelId), label: addAcctLabel, auth_type: "webhook", credentials_ref: addAcctSecret || null }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error ?? "Failed");
      setAddAcctChannelId(""); setAddAcctLabel(""); setAddAcctSecret("");
      await loadAccounts();
      toast({ title: t("space.cs_acct_added") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAcctBusy(false);
    }
  };
  const deleteAccount = async (accountId: number) => {
    try {
      await apiFetch(`/api/v1/channel-accounts/${accountId}`, { method: "DELETE" });
      await loadAccounts();
      toast({ title: t("space.cs_acct_removed") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const toggleRateDate = (d: string) => setSelDates((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  const goRateMonth = (m: Date) => { setRateMonth(m); setSelDates([]); loadRates(m); };
  const applyRates = async () => {
    if (selDates.length === 0) return;
    setRateBusy(true);
    try {
      const rates = selDates.map((date) => ({
        date,
        rate: rateVal ? Number(rateVal) : null,
        min_stay: minStay ? Number(minStay) : null,
        max_stay: maxStay ? Number(maxStay) : null,
        closed_to_arrival: cta,
        closed_to_departure: ctd,
      }));
      const res = await apiFetch(`/api/v1/spaces/${spaceId}/rate-calendar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates }),
      });
      if (!res.ok) throw new Error("Failed to apply rates");
      setSelDates([]);
      await loadRates(rateMonth);
      toast({ title: t("space.cs_rates_applied") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setRateBusy(false);
    }
  };

  const accountsByChannel = (channelId: number) => accounts.filter((a) => a.channel_id === channelId);
  const rateMap = new Map(rateRows.map((r) => [r.date, r]));

  if (connectedChannels.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("space.cs_no_connected")}</p>;
  }

  // Build the rate-calendar month grid cells.
  const offset = getDay(rateMonth);
  const total = endOfMonth(rateMonth).getDate();
  const cells: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => format(new Date(rateMonth.getFullYear(), rateMonth.getMonth(), i + 1), "yyyy-MM-dd")),
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* ── Accounts & webhooks ───────────────────────────── */}
      <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
        <div className="border-b pb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.cs_accounts_title")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("space.cs_accounts_desc")}</p>
        </div>

        {connectedChannels.map((ch) => (
          <div key={ch.id} className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{ch.name}</Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_webhook_url")}</Label>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono flex-1 truncate" title={webhookUrl(ch.code)}>{webhookUrl(ch.code)}</code>
                <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => copyWebhook(ch.code)}>
                  {copiedCode === ch.code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode === ch.code ? t("space.cs_copied") : t("space.cs_copy")}
                </Button>
              </div>
            </div>
            {accountsByChannel(ch.id).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("space.cs_no_accounts")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {accountsByChannel(ch.id).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-sm rounded border bg-background px-3 py-1.5">
                    <span>{a.label} <span className="text-xs text-muted-foreground">({a.auth_type})</span></span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteAccount(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Add account / webhook secret */}
        <div className="border-t pt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_channel")}</Label>
            <Select value={addAcctChannelId} onValueChange={setAddAcctChannelId}>
              <SelectTrigger><SelectValue placeholder={t("space.cs_select_channel")} /></SelectTrigger>
              <SelectContent>
                {connectedChannels.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-40">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_label")}</Label>
            <Input value={addAcctLabel} placeholder={t("space.cs_label_ph")} onChange={(e) => setAddAcctLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_secret")}</Label>
            <Input value={addAcctSecret} placeholder={t("space.cs_secret_ph")} onChange={(e) => setAddAcctSecret(e.target.value)} className="font-mono text-xs" />
          </div>
          <Button type="button" size="sm" disabled={!addAcctChannelId || !addAcctLabel || acctBusy} onClick={addAccount} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />{t("space.cs_add_account")}
          </Button>
        </div>
      </div>

      {/* ── OTA reservations ──────────────────────────────── */}
      <div className="bg-card rounded-lg border p-5 flex flex-col gap-3">
        <div className="border-b pb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.cs_reservations_title")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("space.cs_reservations_desc")}</p>
        </div>
        {reservations.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("space.cs_no_reservations")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-1.5 pr-3">{t("space.cs_col_ext")}</th>
                  <th className="py-1.5 pr-3">{t("space.cs_col_guest")}</th>
                  <th className="py-1.5 pr-3">{t("space.cs_col_dates")}</th>
                  <th className="py-1.5 pr-3">{t("space.cs_col_amount")}</th>
                  <th className="py-1.5 pr-3">{t("space.cs_col_status")}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-xs">{r.external_reservation_id}</td>
                    <td className="py-1.5 pr-3">{r.guest_name ?? "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(r.check_in_date)} → {formatDate(r.check_out_date)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.total_amount ? `${r.total_amount} ${r.currency ?? ""}` : "—"}</td>
                    <td className="py-1.5 pr-3">
                      <Badge variant={r.reservation_status === "Cancelled" ? "destructive" : r.reservation_status === "Mapped" ? "outline" : "secondary"} className="text-[10px]">
                        {r.reservation_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Rate & restriction calendar ───────────────────── */}
      <div className="bg-card rounded-lg border p-5 flex flex-col gap-3">
        <div className="border-b pb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.cs_rates_title")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("space.cs_rates_desc")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goRateMonth(addMonths(rateMonth, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-36 text-center">{format(rateMonth, "MMMM yyyy")}</span>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goRateMonth(addMonths(rateMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => goRateMonth(startOfMonth(new Date()))}>{t("space.cs_today")}</Button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <div key={i}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`b${idx}`} />;
            const r = rateMap.get(dateStr);
            const selected = selDates.includes(dateStr);
            const dayNum = Number(dateStr.slice(-2));
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => toggleRateDate(dateStr)}
                className={cn(
                  "min-h-[3rem] rounded border p-1 flex flex-col items-center justify-start text-xs transition-colors",
                  selected ? "bg-primary/20 border-primary/50 text-primary" : r?.closed_to_arrival || r?.closed_to_departure ? "bg-rose-50 border-rose-200" : r ? "bg-blue-50 border-blue-200" : "bg-muted/30 border-muted",
                )}
              >
                <span className="font-medium">{dayNum}</span>
                {r?.rate != null && <span className="text-[9px] leading-tight mt-0.5">{Number(r.rate).toFixed(0)}</span>}
                {r?.min_stay != null && <span className="text-[8px] leading-tight opacity-70">≥{r.min_stay}</span>}
              </button>
            );
          })}
        </div>

        {/* Apply form */}
        <div className="border-t pt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 w-28">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_rate")}</Label>
              <Input type="number" value={rateVal} onChange={(e) => setRateVal(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5 w-24">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_min_stay")}</Label>
              <Input type="number" value={minStay} onChange={(e) => setMinStay(e.target.value)} placeholder="—" />
            </div>
            <div className="flex flex-col gap-1.5 w-24">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.cs_max_stay")}</Label>
              <Input type="number" value={maxStay} onChange={(e) => setMaxStay(e.target.value)} placeholder="—" />
            </div>
            <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={cta} onCheckedChange={(v) => setCta(!!v)} />{t("space.cs_cta")}</label>
            <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={ctd} onCheckedChange={(v) => setCtd(!!v)} />{t("space.cs_ctd")}</label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={selDates.length === 0 || rateBusy} onClick={applyRates}>
              {t("space.cs_apply")} {selDates.length > 0 ? `(${selDates.length})` : ""}
            </Button>
            {selDates.length > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelDates([])}>{t("space.cs_clear_sel")}</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{t("space.cs_rates_hint")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
