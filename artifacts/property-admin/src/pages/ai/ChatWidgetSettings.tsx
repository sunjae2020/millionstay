import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Loader2, ExternalLink, Bot, AlertCircle, CheckCircle2 } from "lucide-react";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";

const ACCENT = "hsl(var(--primary))";

interface IntegrationStatus {
  ai: { configured: boolean; masked_key: string; model: string | null; cs_translate_model?: string | null; widget_enabled: boolean; error: string | null };
}

// Shortcut options for the CS auto-translation model. Haiku is the
// cost-effective default; Sonnet is higher quality and more expensive.
//
// This is a convenience picker over the same CS_TRANSLATE_MODEL setting that
// Settings → AI · 사용량 edits. That page is the full surface — it can point the
// task at any provider — so anything not in this short list is shown read-only
// here with a link there, rather than being silently reset by this dropdown.
const CS_TRANSLATE_MODELS = [
  { value: "claude-haiku-4-5", labelKey: "ai.cs_translate.model_haiku" },
  { value: "claude-sonnet-4-6", labelKey: "ai.cs_translate.model_sonnet" },
];

export default function ChatWidgetSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => apiFetch(`/api/v1/integrations/status?t=${Date.now()}`).then((r) => r.json()),
  });
  const status: IntegrationStatus | undefined = data?.data;
  const enabled = status?.ai.widget_enabled ?? true;
  const configured = status?.ai.configured ?? false;
  // The status endpoint reports a canonical `provider/model` ref; this picker
  // only ever offered bare Anthropic names, so strip the prefix to compare.
  const csModelRef = status?.ai.cs_translate_model ?? "anthropic/claude-haiku-4-5";
  const csModel = csModelRef.includes("/") ? csModelRef.slice(csModelRef.indexOf("/") + 1) : csModelRef;
  const csModelIsListed = CS_TRANSLATE_MODELS.some((m) => m.value === csModel);

  async function setCsModel(next: string) {
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key: "CS_TRANSLATE_MODEL", value: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      await qc.invalidateQueries({ queryKey: ["integration-status"] });
      toast({ title: t("ai.cs_translate.saved_toast", "Translation model updated") });
    } catch (e: any) {
      toast({ title: t("ai.widget.update_error"), description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const { data: kb } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => apiJson<{ success: boolean; data: unknown[] }>("/api/v1/knowledge"),
  });
  const docCount = kb?.data?.length ?? 0;

  async function setEnabled(next: boolean) {
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/integrations/update-env", {
        method: "POST",
        body: JSON.stringify({ key: "CHAT_WIDGET_ENABLED", value: next ? "true" : "false" }),
      });
      if (!res.ok) throw new Error("Save failed");
      await qc.invalidateQueries({ queryKey: ["integration-status"] });
      toast({ title: next ? t("ai.widget.enabled_toast") : t("ai.widget.disabled_toast") });
    } catch (e: any) {
      toast({ title: t("ai.widget.update_error"), description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        title={t("ai.widget.title")}
        subtitle={t("ai.widget.subtitle")}
      />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_400px]">
        {/* Settings column */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold">{t("ai.widget.show_label")}</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("ai.widget.show_help")}
                </p>
              </div>
              <Switch checked={enabled} disabled={saving} onCheckedChange={setEnabled} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">{t("ai.widget.readiness")}</h3>
            <div className="space-y-2.5 text-sm">
              <StatusRow
                ok={configured}
                okText={`${t("ai.widget.ai_key_ok")}${status?.ai.model ? ` · ${status.ai.model}` : ""}`}
                badText={t("ai.widget.ai_key_bad")}
              />
              <StatusRow
                ok={docCount > 0}
                okText={t("ai.widget.docs_ok", { count: docCount })}
                badText={t("ai.widget.docs_bad")}
              />
              <StatusRow
                ok={enabled}
                okText={t("ai.widget.visible_ok")}
                badText={t("ai.widget.visible_bad")}
              />
            </div>
            {!configured && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t("ai.widget.preview_note")}
              </p>
            )}
          </Card>

          {/* CS message auto-translation model */}
          <Card className="p-5">
            <Label className="text-sm font-semibold">{t("ai.cs_translate.title", "CS Auto-Translation Model")}</Label>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              {t("ai.cs_translate.help", "Model used to translate customer-support messages between the customer's language and English. Haiku is fast and low-cost; Sonnet is higher quality but more expensive.")}
            </p>
            {csModelIsListed ? (
              <select
                value={csModel}
                disabled={saving || !configured}
                onChange={(e) => void setCsModel(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
              >
                {CS_TRANSLATE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-1.5">
                <code className="block w-full rounded-lg border bg-muted px-3 py-2 text-sm font-mono">
                  {csModelRef}
                </code>
                <p className="text-xs text-muted-foreground">
                  {t("ai.cs_translate.managed_elsewhere", "This task is set to a model outside this shortcut list. Change it in Settings → AI & usage.")}{" "}
                  <Link href="/settings/ai" className="text-primary hover:underline">/settings/ai</Link>
                </p>
              </div>
            )}
            {!configured && (
              <p className="mt-2 text-xs text-amber-600">{t("ai.cs_translate.needs_key", "Set the Anthropic API key above to enable translation.")}</p>
            )}
          </Card>
        </div>

        {/* Live preview column */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MessageCircle className="h-4 w-4" /> {t("ai.widget.live_preview")}
          </div>
          <ChatPreview />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("ai.widget.live_preview_note")}
          </p>
        </div>
      </div>
    </Layout>
  );
}

function StatusRow({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
      <span className={ok ? "" : "text-muted-foreground"}>{ok ? okText : badText}</span>
    </div>
  );
}

/* ── Embedded chat tester — a compact replica of the public widget ── */

interface RoomCard {
  space_id: number;
  name?: string;
  space_type?: string;
  weekly_price?: number | string | null;
  currency?: string | null;
  city?: string | null;
  booking_link?: string;
}
interface PreviewMsg { role: "user" | "assistant"; text: string; rooms?: RoomCard[] }

function ChatPreview() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [messages, setMessages] = useState<PreviewMsg[]>([{ role: "assistant", text: t("ai.preview.greeting") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const sessionId = useRef<string>(`admin-preview-${Math.random().toString(36).slice(2)}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, hint]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    setHint(null);

    const patchLast = (fn: (m: PreviewMsg) => PreviewMsg) =>
      setMessages((m) => {
        const c = m.slice();
        const i = c.length - 1;
        if (i >= 0 && c[i].role === "assistant") c[i] = fn(c[i]);
        return c;
      });

    try {
      const res = await fetch("/api/v1/public/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId.current, message: text, conversation_id: conversationId.current }),
      });
      if (!res.ok || !res.body) {
        patchLast((m) => ({ ...m, text: res.status === 503 ? t("ai.preview.error_not_configured") : t("ai.preview.error_generic") }));
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const evt of parts) {
          const line = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let d: any;
          try { d = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (d.type === "meta") conversationId.current = d.conversation_id;
          else if (d.type === "delta") { setHint(null); patchLast((m) => ({ ...m, text: m.text + d.text })); }
          else if (d.type === "tool") setHint(t("ai.preview.working"));
          else if (d.type === "ui" && d.kind === "spaces" && Array.isArray(d.data)) patchLast((m) => ({ ...m, rooms: d.data }));
          else if (d.type === "error") patchLast((m) => ({ ...m, text: m.text || d.message }));
        }
      }
    } catch {
      patchLast((m) => ({ ...m, text: m.text || t("ai.preview.error_network") }));
    } finally {
      setBusy(false);
      setHint(null);
    }
  }, [input, busy, t]);

  return (
    <div className="flex h-[520px] w-full flex-col overflow-hidden rounded-2xl border shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: ACCENT }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-semibold">M</div>
        <div className="text-sm font-semibold">{t("ai.preview.title")}</div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 px-3 py-4">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "text-white" : "bg-card shadow-sm"}`}
                style={m.role === "user" ? { backgroundColor: ACCENT } : undefined}
              >
                {m.text || (busy && i === messages.length - 1
                  ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("ai.preview.thinking")}</span>
                  : "")}
              </div>
            </div>
            {m.rooms && m.rooms.length > 0 && (
              <div className="mt-2 space-y-2">
                {m.rooms.map((r) => (
                  <a key={r.space_id} href={r.booking_link} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 rounded-xl border bg-card p-2 text-sm shadow-sm hover:shadow">
                    <Bot className="h-4 w-4" style={{ color: ACCENT }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name ?? t("ai.preview.room_fallback", { id: r.space_id })}</div>
                      <div className="truncate text-xs text-muted-foreground">{[r.city, r.space_type].filter(Boolean).join(" · ")}</div>
                    </div>
                    {r.weekly_price != null && <span className="text-xs font-semibold" style={{ color: ACCENT }}>{formatMoney(r.weekly_price, r.currency ?? currency, currencyPosition)}</span>}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {hint && <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {hint}</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t bg-card p-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={t("ai.preview.placeholder")}
          rows={1}
          className="max-h-24 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
