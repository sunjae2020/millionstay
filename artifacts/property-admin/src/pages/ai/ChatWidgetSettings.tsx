import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Loader2, ExternalLink, Bot, AlertCircle, CheckCircle2 } from "lucide-react";

const ACCENT = "#E8621A";

interface IntegrationStatus {
  ai: { configured: boolean; masked_key: string; model: string | null; widget_enabled: boolean; error: string | null };
}

export default function ChatWidgetSettings() {
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
      toast({ title: next ? "Chat widget enabled on landing page" : "Chat widget hidden from landing page" });
    } catch (e: any) {
      toast({ title: "Could not update", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Chat Widget"
        subtitle="Control the landing-page AI chat assistant and try it out live."
      />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_400px]">
        {/* Settings column */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold">Show chat widget on the landing page</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  When on, visitors at millionstay.com see the floating chat button. Turn off to hide it for everyone.
                </p>
              </div>
              <Switch checked={enabled} disabled={saving} onCheckedChange={setEnabled} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Readiness</h3>
            <div className="space-y-2.5 text-sm">
              <StatusRow
                ok={configured}
                okText={`AI key configured${status?.ai.model ? ` · ${status.ai.model}` : ""}`}
                badText="AI key not set — add it in Settings → Integrations → AI Chatbot"
              />
              <StatusRow
                ok={docCount > 0}
                okText={`${docCount} knowledge document${docCount === 1 ? "" : "s"} available`}
                badText="No knowledge documents yet — add FAQ/policy content in Knowledge Base"
              />
              <StatusRow
                ok={enabled}
                okText="Widget is visible on the landing page"
                badText="Widget is hidden from the landing page"
              />
            </div>
            {!configured && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                The preview will say "temporarily unavailable" until the AI key is configured.
              </p>
            )}
          </Card>
        </div>

        {/* Live preview column */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MessageCircle className="h-4 w-4" /> Live preview
          </div>
          <ChatPreview />
          <p className="mt-2 text-xs text-muted-foreground">
            This talks to the real assistant — messages here are saved like any visitor conversation.
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

const GREETING = "Hi! I'm Milly, the MillionStay assistant. Ask me about rooms, prices, availability, or booking — in any language.";

function ChatPreview() {
  const [messages, setMessages] = useState<PreviewMsg[]>([{ role: "assistant", text: GREETING }]);
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
        patchLast((m) => ({ ...m, text: res.status === 503 ? "The assistant is not configured yet (set the AI key)." : "Something went wrong." }));
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
          else if (d.type === "tool") setHint("Working…");
          else if (d.type === "ui" && d.kind === "spaces" && Array.isArray(d.data)) patchLast((m) => ({ ...m, rooms: d.data }));
          else if (d.type === "error") patchLast((m) => ({ ...m, text: m.text || d.message }));
        }
      }
    } catch {
      patchLast((m) => ({ ...m, text: m.text || "Network error." }));
    } finally {
      setBusy(false);
      setHint(null);
    }
  }, [input, busy]);

  return (
    <div className="flex h-[520px] w-full flex-col overflow-hidden rounded-2xl border shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: ACCENT }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-semibold">M</div>
        <div className="text-sm font-semibold">MillionStay Assistant</div>
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
                  ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…</span>
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
                      <div className="truncate font-medium">{r.name ?? `Room #${r.space_id}`}</div>
                      <div className="truncate text-xs text-muted-foreground">{[r.city, r.space_type].filter(Boolean).join(" · ")}</div>
                    </div>
                    {r.weekly_price != null && <span className="text-xs font-semibold" style={{ color: ACCENT }}>{r.currency ?? "AUD"} {r.weekly_price}</span>}
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
          placeholder="Type a test message…"
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
