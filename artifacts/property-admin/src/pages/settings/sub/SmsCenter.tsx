import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, useServerList, type ColumnDef } from "@/components/ui/data-table";
import { ALL, SearchBox } from "@/components/list-filters";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, MessageSquare, RefreshCw, Send, XCircle, Ban } from "lucide-react";

/* ── 서버 응답 ────────────────────────────────────────────────────────── */
interface SmsStatus {
  configured: boolean; api_key: boolean; api_secret: boolean;
  sender_number: string | null; ad_opt_out_number: string | null; advertising_ready: boolean;
  kakao_pf_id: boolean; missing: string[]; balance: number | null;
  /** SOLAPI 에 등록·승인된 발신번호. null = 조회 실패. */
  registered_senders: string[] | null;
  /** 설정된 발신번호가 그 목록에 있나. null = 모름. */
  sender_registered: boolean | null;
}
interface SmsSummary { today: number; month: number; failed_month: number }
interface SmsTemplate { key: string; name: string; description: string | null; body: string; variables: string[] }
interface LogRow {
  id: number; sent_at: string; to: string; to_name: string | null; template_code: string | null;
  status: string; message_id: string | null; error_message: string | null; entity_type: string | null; entity_id: number | null;
}
interface ShareLink {
  id: number; label: string | null; ref: string | null; file_name: string; sent_to: string | null; recipient_name: string | null;
  url: string; expires_at: string; viewed_at: string | null; view_count: number; revoked_at: string | null; created_at: string;
}

/** lib/sms.ts smsBytes 와 같은 규칙 — ASCII 1byte, 그 외 2byte. */
function smsBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += /[\x00-\x7F]/.test(ch) ? 1 : 2;
  return n;
}
function prettyPhone(p: string): string {
  return /^\d{11}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : /^\d{10}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p;
}
function entityHref(type: string | null, id: number | null): string | null {
  if (!type || !id) return null;
  if (type === "invoice") return `/finance/invoices/${id}`;
  if (type === "contract") return `/contracts/${id}`;
  if (type === "quote") return `/documents/quotes/${id}`;
  if (type === "work_order") return `/work-orders/${id}`;
  return null;
}

const SORTABLE_KEYS = ["sent_at", "status", "to", "template_code"];

export default function SmsCenterPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["sms-status"],
    queryFn: () => apiJson<{ data: SmsStatus }>("/api/v1/sms/status").then((r) => r.data),
    staleTime: 60_000,
  });
  const summary = useQuery({
    queryKey: ["sms-summary"],
    queryFn: () => apiJson<{ data: SmsSummary }>("/api/v1/sms/summary").then((r) => r.data),
  });
  const templates = useQuery({
    queryKey: ["sms-templates"],
    queryFn: () => apiJson<{ data: SmsTemplate[] }>("/api/v1/sms/templates").then((r) => r.data),
    staleTime: 300_000,
  });

  /* ── 직접 발송 ─────────────────────────────────────────────────────── */
  const [toText, setToText] = useState("");
  const [text, setText] = useState("");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<Array<{ phone: string; ok: boolean; skipped: boolean; error?: string; type?: string }> | null>(null);

  const bytes = smsBytes(text);
  const kind = bytes <= 90 ? "SMS" : bytes <= 2000 ? "LMS" : "OVER";
  const recipients = toText.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
  const canSend = recipients.length > 0 && text.trim().length > 0 && kind !== "OVER" && !sending;

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const tpl = templates.data?.find((x) => x.key === key);
    if (tpl) setText(tpl.body);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setLastResult(null);
    try {
      const res = await apiFetch("/api/v1/sms/send", {
        method: "POST",
        body: JSON.stringify({ to: recipients, text }),
      });
      const body = await res.json().catch(() => ({}));
      const results = body?.data?.results ?? [];
      setLastResult(results);
      if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      toast({ title: t("sms_center.sent_toast", "Sent"), description: t("sms_center.sent_toast_desc", "{{n}} message(s) sent.", { n: body.data.sent }) });
      setToText("");
      void qc.invalidateQueries({ queryKey: ["sms-summary"] });
      void qc.invalidateQueries({ queryKey: ["sms-status"] });
      logs.invalidate();
    } catch (err) {
      toast({ title: t("sms_center.send_failed", "Could not send"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  /* ── 발송 내역 ─────────────────────────────────────────────────────── */
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const filters = useMemo(() => ({ q, status: statusFilter === ALL ? "" : statusFilter }), [q, statusFilter]);
  const logs = useServerList<LogRow>("/api/v1/sms/logs", {
    filters,
    sortableKeys: SORTABLE_KEYS,
    defaultSort: { key: "sent_at", dir: "desc" },
    defaultPageSize: 50,
  });

  const statusBadge = (s: string) =>
    s === "Sent" ? <Badge className="bg-emerald-600 hover:bg-emerald-600">{t("sms_center.status_sent", "Sent")}</Badge>
      : s === "Failed" ? <Badge variant="destructive">{t("sms_center.status_failed", "Failed")}</Badge>
        : <Badge variant="secondary">{t("sms_center.status_skipped", "Skipped")}</Badge>;

  const columns: ColumnDef<LogRow>[] = useMemo(() => [
    { key: "sent_at", header: "sms_center.col_sent_at", cell: (r) => formatDateTime(r.sent_at), defaultWidth: 160 },
    { key: "to", header: "sms_center.col_to", cell: (r) => <span className="font-mono text-xs">{prettyPhone(r.to)}</span>, defaultWidth: 130 },
    { key: "to_name", header: "sms_center.col_name", cell: (r) => r.to_name ?? "—", sortable: false, defaultWidth: 110 },
    { key: "template_code", header: "sms_center.col_template", cell: (r) => <span className="font-mono text-xs">{r.template_code ?? "—"}</span>, defaultWidth: 180 },
    { key: "status", header: "sms_center.col_status", cell: (r) => statusBadge(r.status), defaultWidth: 90 },
    { key: "error_message", header: "sms_center.col_error", cell: (r) => <span className="text-xs text-destructive">{r.error_message ?? ""}</span>, sortable: false, defaultWidth: 220 },
    {
      key: "entity", header: "sms_center.col_record", sortable: false, defaultWidth: 140,
      cell: (r) => {
        const href = entityHref(r.entity_type, r.entity_id);
        const label = r.entity_type ? `${r.entity_type} #${r.entity_id}` : "—";
        return href ? <Link href={href} className="text-primary hover:underline text-xs">{label}</Link> : <span className="text-xs">{label}</span>;
      },
    },
  ], [t]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 문서 링크 ─────────────────────────────────────────────────────── */
  const links = useQuery({
    queryKey: ["sms-share-links"],
    queryFn: () => apiJson<{ data: ShareLink[] }>("/api/v1/documents/sms-links").then((r) => r.data),
  });
  const revoke = async (id: number) => {
    const res = await apiFetch(`/api/v1/documents/sms-links/${id}/revoke`, { method: "POST" });
    if (res.ok) { toast({ title: t("sms_center.link_revoked", "Link revoked") }); void links.refetch(); }
    else toast({ title: t("sms_center.link_revoke_failed", "Could not revoke"), variant: "destructive" });
  };
  const linkState = (l: ShareLink) => {
    if (l.revoked_at) return <Badge variant="secondary"><Ban className="h-3 w-3 mr-1" />{t("sms_center.link_revoked_badge", "Revoked")}</Badge>;
    if (new Date(l.expires_at).getTime() < Date.now()) return <Badge variant="secondary">{t("sms_center.link_expired", "Expired")}</Badge>;
    if (l.viewed_at) return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />{t("sms_center.link_viewed", "Viewed {{n}}×", { n: l.view_count })}</Badge>;
    return <Badge variant="outline">{t("sms_center.link_unopened", "Not opened")}</Badge>;
  };

  const s = status.data;

  return (
    <Layout>
      <PageHeader
        title={<><MessageSquare className="h-5 w-5" /> {t("nav.sms_center", "Text messages")}</>}
        subtitle={t("sms_center.subtitle", "Send texts, review what went out, and manage document links (SOLAPI)")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { void status.refetch(); void summary.refetch(); logs.invalidate(); void links.refetch(); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> {t("common.refresh", "Refresh")}
            </Button>
            <Link href="/settings/integrations">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" /> {t("sms_center.go_integrations", "Connection settings")}</Button>
            </Link>
          </>
        }
      />
      <div className="p-4 sm:p-6 space-y-5">
        {/* 상태 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label={t("sms_center.card_status", "Status")}>
            {status.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : s?.configured && s?.sender_registered !== false
              ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{t("sms_center.ready", "Ready")}</span>
              : <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{t("sms_center.not_ready", "Not ready")}</span>}
          </StatCard>
          <StatCard label={t("sms_center.card_sender", "Sender number")}>
            <span className={`font-mono ${s?.sender_registered === false ? "text-destructive" : ""}`}>
              {s?.sender_number ? prettyPhone(s.sender_number) : "—"}
            </span>
            {s?.sender_registered === false && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
          </StatCard>
          <StatCard label={t("sms_center.card_balance", "Balance")}>
            {s?.balance == null ? "—" : `${s.balance.toLocaleString()}원`}
          </StatCard>
          <StatCard label={t("sms_center.card_today", "Today / this month")}>
            {summary.data ? `${summary.data.today} / ${summary.data.month}` : "—"}
          </StatCard>
          <StatCard label={t("sms_center.card_failed", "Failed this month")}>
            <span className={summary.data?.failed_month ? "text-destructive" : ""}>{summary.data?.failed_month ?? "—"}</span>
          </StatCard>
        </div>
        {s && !s.configured && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">{t("sms_center.missing_title", "Nothing will be sent until these are set:")}</p>
            <p className="font-mono text-xs mt-1">{s.missing.join(", ")}</p>
            <Link href="/settings/integrations" className="text-primary text-xs hover:underline inline-flex items-center gap-1 mt-1">
              {t("sms_center.go_integrations", "Connection settings")} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
        {/* 키·잔액이 멀쩡해도 발신번호가 사전등록돼 있지 않으면 한 통도 나가지
            않는다(SOLAPI 1062). 발송해 보기 전에 여기서 말해 준다. */}
        {s?.sender_registered === false && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              {t("sms_center.sender_unregistered", "{{number}} is not a registered sender number — SOLAPI will reject every message (error 1062).", { number: prettyPhone(s.sender_number ?? "") })}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.registered_senders?.length
                ? t("sms_center.sender_registered_list", "Registered on this account: {{list}}", { list: s.registered_senders.map(prettyPhone).join(", ") })
                : t("sms_center.sender_none_registered", "This account has no registered sender number yet.")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("sms_center.sender_fix", "Register the number in the SOLAPI console (business registration + a telecom service certificate, approved in 1–2 business days), or set an already-approved number in the connection settings.")}
            </p>
            <div className="flex items-center gap-3 pt-0.5">
              <Link href="/settings/integrations" className="text-primary text-xs hover:underline inline-flex items-center gap-1">
                {t("sms_center.go_integrations", "Connection settings")} <ExternalLink className="h-3 w-3" />
              </Link>
              <a href="https://console.solapi.com/sender-ids" target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline inline-flex items-center gap-1">
                {t("sms_center.open_console", "SOLAPI console")} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        <Tabs defaultValue="send">
          <TabsList>
            <TabsTrigger value="send">{t("sms_center.tab_send", "Send")}</TabsTrigger>
            <TabsTrigger value="logs">{t("sms_center.tab_logs", "History")}</TabsTrigger>
            <TabsTrigger value="links">{t("sms_center.tab_links", "Document links")}</TabsTrigger>
          </TabsList>

          {/* ── 직접 발송 ── */}
          <TabsContent value="send" className="pt-4">
            <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("sms_center.to", "Recipients")}</Label>
                  <Textarea rows={4} value={toText} onChange={(e) => setToText(e.target.value)}
                    placeholder={t("sms_center.to_placeholder", "010-1234-5678 — one per line, up to 50")} className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">{t("sms_center.to_count", "{{n}} recipient(s)", { n: recipients.length })}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sms_center.template", "Load a template")}</Label>
                  <Select value={templateKey} onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder={t("sms_center.template_placeholder", "Optional — start from a saved message")} /></SelectTrigger>
                    <SelectContent>
                      {(templates.data ?? []).map((tp) => (
                        <SelectItem key={tp.key} value={tp.key}>{tp.name} <span className="text-muted-foreground font-mono text-xs ml-1">{tp.key}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{t("sms_center.message", "Message")}</Label>
                    <span className={`text-xs font-mono ${kind === "OVER" ? "text-destructive" : kind === "LMS" ? "text-amber-600" : "text-muted-foreground"}`}>
                      {bytes} B · {kind === "OVER" ? t("sms_center.too_long", "too long") : kind}
                    </span>
                  </div>
                  <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder={t("sms_center.message_placeholder", "[Brand] is filled in automatically as {{brand}}. {{name}} becomes the recipient's name when known.")} />
                  <p className="text-xs text-muted-foreground">{t("sms_center.message_hint", "Up to 90 bytes goes as SMS (Korean = 2 bytes per character); longer texts go as LMS at about 3× the cost. Emoji cannot be sent.")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => void handleSend()} disabled={!canSend || !s?.configured || s?.sender_registered === false}>
                    {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                    {t("sms_center.send_button", "Send now")}
                  </Button>
                  {s && !s.configured && <span className="text-xs text-muted-foreground">{t("sms_center.not_ready_hint", "Set the sender number first.")}</span>}
                  {s?.configured && s.sender_registered === false && <span className="text-xs text-destructive">{t("sms_center.not_registered_hint", "Register the sender number before sending.")}</span>}
                </div>
              </div>
              <div className="space-y-3">
                <Label>{t("sms_center.preview", "Preview")}</Label>
                <div className="rounded-2xl border bg-muted/40 p-4 max-w-sm">
                  <div className="rounded-xl bg-background border px-3 py-2 text-sm whitespace-pre-wrap break-words min-h-[4rem]">
                    {text ? text.replace(/\{\{brand\}\}/g, "[브랜드]").replace(/\{\{name\}\}/g, "고객") : <span className="text-muted-foreground">{t("sms_center.preview_empty", "Your message will appear here.")}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">{t("sms_center.preview_from", "From")}: {s?.sender_number ? prettyPhone(s.sender_number) : "—"}</p>
                </div>
                {lastResult && (
                  <div className="space-y-1">
                    <Label>{t("sms_center.result", "Result")}</Label>
                    <ul className="text-sm space-y-1">
                      {lastResult.map((r) => (
                        <li key={r.phone} className="flex items-center gap-2">
                          {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          <span className="font-mono text-xs">{prettyPhone(r.phone)}</span>
                          <span className="text-xs text-muted-foreground">{r.ok ? r.type : r.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── 발송 내역 ── */}
          <TabsContent value="logs" className="pt-4">
            <DataTable
              tableKey="sms-logs"
              columns={columns}
              data={logs.rows}
              server={logs.server}
              isLoading={logs.isLoading}
              rowKey={(r) => r.id}
              emptyText={t("sms_center.logs_empty", "No text messages yet.")}
              exportFileName="sms-log"
              toolbarExtra={
                <div className="flex flex-wrap items-center gap-2">
                  <SearchBox value={q} onChange={setQ} placeholder={t("sms_center.search_placeholder", "Number, name, template…")} />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("sms_center.status_all", "All statuses")}</SelectItem>
                      <SelectItem value="Sent">{t("sms_center.status_sent", "Sent")}</SelectItem>
                      <SelectItem value="Failed">{t("sms_center.status_failed", "Failed")}</SelectItem>
                      <SelectItem value="Skipped">{t("sms_center.status_skipped", "Skipped")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />
          </TabsContent>

          {/* ── 문서 링크 ── */}
          <TabsContent value="links" className="pt-4">
            <p className="text-xs text-muted-foreground mb-3">{t("sms_center.links_hint", "Links sent from the document preview. Revoke one to stop it opening immediately.")}</p>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">{t("sms_center.col_sent_at", "Sent")}</th>
                    <th className="text-left px-3 py-2">{t("sms_center.col_document", "Document")}</th>
                    <th className="text-left px-3 py-2">{t("sms_center.col_to", "To")}</th>
                    <th className="text-left px-3 py-2">{t("sms_center.col_status", "Status")}</th>
                    <th className="text-left px-3 py-2">{t("sms_center.col_expires", "Expires")}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {links.isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
                  {!links.isLoading && !(links.data?.length) && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{t("sms_center.links_empty", "No document links yet.")}</td></tr>}
                  {(links.data ?? []).map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                      <td className="px-3 py-2"><div className="font-medium">{l.label ?? "—"}{l.ref ? <span className="text-muted-foreground font-mono text-xs ml-1">{l.ref}</span> : null}</div><div className="text-xs text-muted-foreground truncate max-w-[260px]">{l.file_name}</div></td>
                      <td className="px-3 py-2 whitespace-nowrap"><span className="font-mono text-xs">{l.sent_to ? prettyPhone(l.sent_to) : "—"}</span>{l.recipient_name ? <span className="text-xs text-muted-foreground ml-1">{l.recipient_name}</span> : null}</td>
                      <td className="px-3 py-2">{linkState(l)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(l.expires_at)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mr-3">{t("sms_center.open_link", "Open")}</a>
                        {!l.revoked_at && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void revoke(l.id)}>{t("sms_center.revoke", "Revoke")}</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-base font-semibold mt-1 flex items-center gap-1.5">{children}</div>
    </div>
  );
}
