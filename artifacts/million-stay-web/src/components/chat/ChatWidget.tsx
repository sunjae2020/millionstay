import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, ExternalLink } from "lucide-react";
import { getApiBase } from "@/lib/api-base";

/** Brand accent — matches the site's primary orange. */
const ACCENT = "#e07020";

interface RoomCard {
  space_id: number;
  name?: string;
  space_type?: string;
  weekly_price?: number | string | null;
  currency?: string | null;
  city?: string | null;
  property_name?: string | null;
  image?: string | null;
  booking_link?: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  rooms?: RoomCard[];
}

function getSessionId(): string {
  const KEY = "ms_chat_session_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

const GREETING =
  "Hi! I'm Milly, the MillionStay assistant. Ask me about rooms, prices, availability, or how booking works — in any language. How can I help?";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolHint, setToolHint] = useState<string | null>(null);

  const sessionId = useRef<string>("");
  const conversationId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { sessionId.current = getSessionId(); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, toolHint, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    setToolHint(null);

    // Mutate the last (assistant) message as the stream arrives.
    const patchLast = (fn: (msg: ChatMsg) => ChatMsg) =>
      setMessages((m) => {
        const copy = m.slice();
        const i = copy.length - 1;
        if (i >= 0 && copy[i].role === "assistant") copy[i] = fn(copy[i]);
        return copy;
      });

    try {
      const res = await fetch(`${getApiBase()}/api/v1/public/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId.current,
          message: text,
          conversation_id: conversationId.current,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = res.status === 503
          ? "The assistant is temporarily unavailable. Please try again later."
          : "Sorry, something went wrong. Please try again.";
        patchLast((msg) => ({ ...msg, text: errText }));
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let data: any;
          try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }

          switch (data.type) {
            case "meta":
              conversationId.current = data.conversation_id;
              break;
            case "delta":
              setToolHint(null);
              patchLast((msg) => ({ ...msg, text: msg.text + data.text }));
              break;
            case "tool":
              setToolHint(toolLabel(data.name));
              break;
            case "ui":
              if (data.kind === "spaces" && Array.isArray(data.data)) {
                patchLast((msg) => ({ ...msg, rooms: dedupeRooms([...(msg.rooms ?? []), ...data.data]) }));
              }
              break;
            case "error":
              patchLast((msg) => ({ ...msg, text: msg.text || data.message }));
              break;
            case "done":
              if (data.text && !data.text.length) break;
              break;
          }
        }
      }
    } catch {
      patchLast((msg) => ({ ...msg, text: msg.text || "Network error. Please try again." }));
    } finally {
      setBusy(false);
      setToolHint(null);
    }
  }, [input, busy]);

  return (
    <>
      {/* Launcher button */}
      <button
        aria-label={open ? "Close chat" : "Open chat assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 focus:outline-none"
        style={{ backgroundColor: ACCENT }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] flex h-[min(70vh,560px)] w-[min(92vw,384px)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
          <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: ACCENT }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-semibold">M</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">MillionStay Assistant</div>
              <div className="text-xs text-white/80">Ask about rooms, prices & booking</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4">
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === "user" ? "rounded-br-sm text-white" : "rounded-bl-sm bg-white text-gray-800 shadow-sm"
                    }`}
                    style={m.role === "user" ? { backgroundColor: ACCENT } : undefined}
                  >
                    {m.text || (busy && i === messages.length - 1 ? <span className="inline-flex items-center gap-1 text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…</span> : "")}
                  </div>
                </div>
                {m.rooms && m.rooms.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.rooms.map((r) => (
                      <a
                        key={r.space_id}
                        href={r.booking_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:border-gray-300 hover:shadow"
                      >
                        {r.image && <img src={r.image} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900">{r.name ?? `Room #${r.space_id}`}</div>
                          <div className="truncate text-xs text-gray-500">
                            {[r.city, r.space_type].filter(Boolean).join(" · ")}
                          </div>
                          {r.weekly_price != null && (
                            <div className="text-xs font-semibold" style={{ color: ACCENT }}>
                              {r.currency ?? "AUD"} {r.weekly_price}/week
                            </div>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {toolHint && (
              <div className="flex items-center gap-2 px-1 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {toolHint}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-end gap-2 border-t border-gray-100 bg-white p-2.5"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Type your message…"
              rows={1}
              className="max-h-28 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-300"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function toolLabel(name: string): string {
  switch (name) {
    case "search_spaces": return "Searching available rooms…";
    case "get_space_availability": return "Checking availability…";
    case "get_space_details": return "Fetching room details…";
    case "create_inquiry": return "Registering your enquiry…";
    default: return "Working…";
  }
}

function dedupeRooms(rooms: RoomCard[]): RoomCard[] {
  const seen = new Set<number>();
  const out: RoomCard[] = [];
  for (const r of rooms) {
    if (r?.space_id == null || seen.has(r.space_id)) continue;
    seen.add(r.space_id);
    out.push(r);
  }
  return out;
}
