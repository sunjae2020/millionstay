import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  Radio, Link2, RefreshCw, AlertTriangle, CheckCircle2,
  ExternalLink, Loader2, Power, PowerOff, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { KpiCard, DashCard, Pill, ACCENT } from "@/components/dashboard/DashboardKit";

interface Listing {
  id: number;
  space_id: number;
  space_name: string | null;
  channel_id: number;
  channel_code: string | null;
  channel_name: string | null;
  external_listing_id: string | null;
  listing_url: string | null;
  ical_import_url: string | null;
  sync_enabled: boolean;
  sync_availability: boolean;
  last_import_at: string | null;
  last_export_at: string | null;
  last_sync_status: string | null;
  status: string | null;
}

// Channel host/extranet management portals (external).
const CHANNEL_PORTAL: Record<string, { url: string; label: string }> = {
  airbnb: { url: "https://www.airbnb.com/hosting", label: "Airbnb Host" },
  booking_com: { url: "https://admin.booking.com", label: "Booking.com Extranet" },
  expedia: { url: "https://www.expediapartnercentral.com", label: "Expedia Partner Central" },
  agoda: { url: "https://ycs.agoda.com", label: "Agoda YCS" },
};

const SYNC_BADGE: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
};

function relTime(iso: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!iso) return t("dash_channels.rel_never");
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 0) return t("dash_channels.rel_just_now");
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("dash_channels.rel_just_now");
  if (mins < 60) return t("dash_channels.rel_minutes_ago", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("dash_channels.rel_hours_ago", { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t("dash_channels.rel_days_ago", { count: days });
  return new Date(iso).toISOString().slice(0, 10);
}

export default function ChannelsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch("/api/v1/channel-listings");
      const j = await res.json();
      if (j.success) setListings(j.data as Listing[]);
    } catch {
      /* non-critical */
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runImport(l: Listing) {
    if (!l.ical_import_url) {
      toast({ title: t("dash_channels.no_import_url_title"), description: t("dash_channels.no_import_url_desc", { channel: l.channel_name ?? t("dash_channels.channel_fallback") }), variant: "destructive" });
      return;
    }
    setBusy(l.id);
    try {
      const res = await apiFetch(`/api/v1/channel-listings/${l.id}/import`, { method: "POST" });
      const j = await res.json();
      if (j.success) {
        toast({ title: t("dash_channels.sync_complete"), description: `${l.channel_name ?? t("dash_channels.channel_fallback")} · ${l.space_name ?? t("dash_channels.space_fallback")}` });
      } else {
        toast({ title: t("dash_channels.sync_failed"), description: j.error ?? j.data?.message ?? t("dash_channels.import_error"), variant: "destructive" });
      }
      await load(true);
    } catch (e) {
      toast({ title: t("dash_channels.sync_failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function toggleSync(l: Listing) {
    setBusy(l.id);
    try {
      const res = await apiFetch(`/api/v1/channel-listings/${l.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sync_enabled: !l.sync_enabled }),
      });
      const j = await res.json();
      if (j.success) await load(true);
      else toast({ title: t("dash_channels.update_failed"), description: j.error ?? "", variant: "destructive" });
    } catch (e) {
      toast({ title: t("dash_channels.update_failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  // KPIs
  const total = listings.length;
  const enabled = listings.filter(l => l.sync_enabled).length;
  const failed = listings.filter(l => l.last_sync_status === "failed").length;
  const spacesConnected = new Set(listings.map(l => l.space_id)).size;

  // Per-channel breakdown
  const byChannel = listings.reduce((acc, l) => {
    const key = l.channel_code ?? "other";
    (acc[key] ??= { name: l.channel_name ?? key, count: 0, failed: 0, code: key }).count++;
    if (l.last_sync_status === "failed") acc[key].failed++;
    return acc;
  }, {} as Record<string, { name: string; count: number; failed: number; code: string }>);
  const channelCards = Object.values(byChannel).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {t("dash_channels.intro_prefix")}
          {" "}<Link href="/property/spaces" className="text-primary hover:underline">{t("dash_channels.space")}</Link>{t("dash_channels.intro_suffix")}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Link2} accent="brand" label={t("dash_channels.kpi_channel_listings")} value={total} sublabel={t("dash_channels.kpi_spaces_connected", { count: spacesConnected })} />
        <KpiCard icon={Power} accent="green" label={t("dash_channels.kpi_sync_enabled")} value={enabled} sublabel={t("dash_channels.kpi_paused", { count: total - enabled })} />
        <KpiCard icon={Radio} accent="blue" label={t("dash_channels.kpi_channels")} value={channelCards.length} sublabel={t("dash_channels.kpi_distinct_platforms")} />
        <KpiCard icon={AlertTriangle} accent={failed > 0 ? "red" : "green"} label={t("dash_channels.kpi_failed_syncs")} value={failed} sublabel={failed > 0 ? t("dash_channels.kpi_need_attention") : t("dash_channels.kpi_all_healthy")} trend={failed > 0 ? t("dash_channels.kpi_errors") : undefined} trendType="down" />
      </div>

      {/* Per-channel portals */}
      <DashCard title={t("dash_channels.channel_portals")} icon={ExternalLink}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(CHANNEL_PORTAL).map(([code, p]) => {
            const ch = byChannel[code];
            return (
              <a
                key={code}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border p-3 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: ACCENT.brand.bg, color: ACCENT.brand.fg }}>
                  <Radio className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate flex items-center gap-1">
                    {p.label} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {ch
                      ? `${t("dash_channels.listings_count", { count: ch.count })}${ch.failed ? ` · ${t("dash_channels.failing_count", { count: ch.failed })}` : ""}`
                      : t("dash_channels.not_connected")}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </DashCard>

      {/* All listings table */}
      <DashCard title={t("dash_channels.all_connections")} icon={Link2} bodyClass="p-0">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("dash_channels.loading_connections")}
          </div>
        ) : listings.length === 0 ? (
          <div className="py-12 text-center">
            <Radio className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{t("dash_channels.empty_title")}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t("dash_channels.empty_desc_prefix")}<Link href="/property/spaces" className="text-primary hover:underline">{t("dash_channels.space")}</Link>{t("dash_channels.empty_desc_suffix")}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    { key: "space", label: t("dash_channels.space") },
                    { key: "channel", label: t("dash_channels.col_channel") },
                    { key: "import_url", label: t("dash_channels.col_import_url") },
                    { key: "last_sync", label: t("dash_channels.col_last_sync") },
                    { key: "status", label: t("common.status") },
                    { key: "sync", label: t("dash_channels.col_sync") },
                    { key: "actions", label: "" },
                  ].map(h => (
                    <th key={h.key} className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {listings.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/property/spaces/${l.space_id}`} className="font-medium hover:text-primary flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {l.space_name ?? t("dash_channels.space_numbered", { id: l.space_id })}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{l.channel_name ?? l.channel_code ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[200px]">
                      {l.ical_import_url
                        ? <span className="text-muted-foreground font-mono text-[10px] truncate block" title={l.ical_import_url}>{l.ical_import_url}</span>
                        : <span className="text-muted-foreground/60">{t("dash_channels.export_only")}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{relTime(l.last_import_at, t)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.last_sync_status
                        ? <Pill className={SYNC_BADGE[l.last_sync_status] ?? "bg-gray-100 text-gray-600"}>{l.last_sync_status}</Pill>
                        : <Pill className="bg-gray-100 text-gray-500">{t("dash_channels.sync_never")}</Pill>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => toggleSync(l)}
                        disabled={busy === l.id}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${l.sync_enabled ? "text-green-700" : "text-muted-foreground"}`}
                        title={l.sync_enabled ? t("dash_channels.click_pause_sync") : t("dash_channels.click_enable_sync")}
                      >
                        {l.sync_enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                        {l.sync_enabled ? t("dash_channels.on") : t("dash_channels.off")}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        disabled={busy === l.id || !l.ical_import_url}
                        onClick={() => runImport(l)}
                      >
                        {busy === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {t("dash_channels.import")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        {t("dash_channels.footer_note")}
      </p>
    </div>
  );
}
