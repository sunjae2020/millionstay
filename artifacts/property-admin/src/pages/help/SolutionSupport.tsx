/**
 * Solution Support — where our staff raise requests with the solution vendor
 * (Edubee). The mirror image of /cs/tickets, which is where our own customers
 * raise requests with us.
 *
 * Each request is stored here first and pushed to the vendor's federated intake
 * second, so a vendor outage never loses a write-up. The push state is visible
 * on every row (전송됨 / 대기 / 실패) and a failed one can be retried.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/lib/date";
import {
  Plus, Send, X, Sparkles, Link2, Trash2, ExternalLink, Loader2,
  RefreshCw, Paperclip, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { DataTable, useServerList, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { ALL, SearchBox, ResetFiltersButton } from "@/components/list-filters";

/* ── Types ─────────────────────────────────────────────────────────────── */

type SupportLink = { label: string; url: string };
type SupportAttachment = { name: string; url: string; type?: string };

interface Ticket {
  id: number;
  ticket_ref: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  language: string;
  links: SupportLink[];
  attachments: SupportAttachment[];
  ai_summary: string | null;
  requester_name: string | null;
  external_ticket_id: string | null;
  push_status: string;
  push_error: string | null;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string | null;
}

interface Message {
  id: number;
  ticket_id: number;
  sender_type: string;
  sender_name: string | null;
  message: string;
  attachments: SupportAttachment[];
  push_status: string;
  push_error: string | null;
  created_at: string;
}

interface DeskConfig {
  configured: boolean;
  product: string;
  deskUrl: string;
  requesterOrg: string;
  aiOrganize: boolean;
  categories: string[];
}

/* ── Vocabulary (mirrors the vendor's own categories) ──────────────────── */

const CATEGORIES = ["usage", "billing", "feature", "collab", "bug", "other"] as const;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const PUSH_COLORS: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  queued: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

/* ── Shared bits ───────────────────────────────────────────────────────── */

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return (body?.data ?? body) as T;
}

/** Reference-links editor — used by the new-request form and the thread panel. */
function LinksField({ links, onChange, readOnly }: {
  links: SupportLink[]; onChange?: (next: SupportLink[]) => void; readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const edit = (i: number, k: keyof SupportLink, v: string) =>
    onChange?.(links.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> {t("solution_support.links", "Links")}
          {links.length > 0 && <span className="font-normal opacity-60">· {links.length}</span>}
        </span>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs ml-auto"
            onClick={() => onChange?.([...links, { label: "", url: "" }])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("common.add", "Add")}
          </Button>
        )}
      </div>
      {links.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t pt-2.5">
          {links.map((lk, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {readOnly ? (
                <a href={lk.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate flex-1">{lk.label || lk.url}</a>
              ) : (
                <>
                  <Input value={lk.label} placeholder={t("solution_support.link_label", "Label")}
                    onChange={(e) => edit(i, "label", e.target.value)} className="h-8 text-xs w-36 shrink-0" />
                  <Input value={lk.url} placeholder="https://…"
                    onChange={(e) => edit(i, "url", e.target.value)} className="h-8 text-xs flex-1" />
                  {/^https?:\/\//i.test(lk.url) && (
                    <a href={lk.url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button type="button" onClick={() => onChange?.(links.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-red-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Attachment strip — uploads go to Cloudinary via the API, never inline base64. */
function AttachmentBar({ files, onChange, readOnly }: {
  files: SupportAttachment[]; onChange?: (next: SupportAttachment[]) => void; readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | File[]) => {
    const picked = Array.from(list).slice(0, 10 - files.length);
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const uploaded: SupportAttachment[] = [];
      for (const file of picked) {
        const fd = new FormData();
        fd.append("file", file);
        uploaded.push(await json<SupportAttachment>("/api/v1/solution-support/upload", { method: "POST", body: fd }));
      }
      onChange?.([...files, ...uploaded]);
    } catch (e) {
      toast({
        title: t("solution_support.upload_failed", "Upload failed"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {!readOnly && (
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-muted">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {t("solution_support.attach", "Attach screenshot")}
            <input type="file" multiple accept="image/*,.pdf" className="hidden"
              onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
          </label>
          <span className="text-xs text-muted-foreground">
            {t("solution_support.attach_hint", "or paste an image (Ctrl/Cmd+V)")}
          </span>
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs border rounded px-2 py-1 bg-muted/40">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline max-w-[180px] truncate">{f.name}</a>
              {!readOnly && (
                <button type="button" onClick={() => onChange?.(files.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PushBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const Icon = status === "sent" ? CheckCircle2 : status === "failed" ? AlertTriangle : Clock;
  const label =
    status === "sent" ? t("solution_support.push_sent", "Delivered")
    : status === "failed" ? t("solution_support.push_failed", "Not delivered")
    : t("solution_support.push_queued", "Pending");
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${PUSH_COLORS[status] ?? PUSH_COLORS.queued}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

/* ── New request modal ─────────────────────────────────────────────────── */

function NewRequestDialog({ open, onClose, config }: {
  open: boolean; onClose: () => void; config?: DeskConfig;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("usage");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<SupportLink[]>([]);
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [organizing, setOrganizing] = useState(false);

  const reset = () => {
    setSubject(""); setCategory("usage"); setPriority("normal"); setMessage("");
    setLinks([]); setFiles([]); setAiSummary(""); onClose();
  };

  // The AI result is a SUGGESTION shown next to the note, never a silent
  // overwrite of what the staff member typed.
  const organize = async () => {
    if (!message.trim()) return;
    setOrganizing(true);
    try {
      const r = await json<{ summary: string }>("/api/v1/solution-support/ai/organize", {
        method: "POST",
        body: JSON.stringify({ subject, category, description: message }),
      });
      setAiSummary(r.summary ?? "");
    } catch (e) {
      toast({
        title: t("solution_support.organize_failed", "Could not organize the note"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setOrganizing(false);
    }
  };

  const submit = useMutation({
    mutationFn: () => json<Ticket>("/api/v1/solution-support", {
      method: "POST",
      body: JSON.stringify({
        subject, category, priority, description: message,
        language: (i18n.language || "ko").split("-")[0],
        links: links.filter((l) => /^https?:\/\//i.test(l.url)),
        attachments: files,
        aiSummary: aiSummary.trim() || undefined,
      }),
    }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["solution-support"] });
      toast(
        ticket.push_status === "sent"
          ? { title: t("solution_support.sent_title", "Request sent"), description: ticket.ticket_ref }
          : {
              title: t("solution_support.saved_not_sent_title", "Saved, but not delivered"),
              description: ticket.push_error ?? t("solution_support.saved_not_sent_desc", "Saved locally. Retry delivery from the request."),
              variant: "destructive" as const,
            },
      );
      reset();
    },
    onError: (e: Error) => toast({ title: t("solution_support.send_failed", "Failed to send"), description: e.message, variant: "destructive" }),
  });

  const onPaste = (e: React.ClipboardEvent) => {
    const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    e.preventDefault();
    const fd = new FormData();
    fd.append("file", images[0]!);
    void json<SupportAttachment>("/api/v1/solution-support/upload", { method: "POST", body: fd })
      .then((a) => setFiles((f) => [...f, a].slice(0, 10)))
      .catch(() => toast({ title: t("solution_support.upload_failed", "Upload failed"), variant: "destructive" }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("solution_support.new_title", "New request to the solution team")}</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (subject.trim() && message.trim()) submit.mutate(); }}>
          <div>
            <label className="text-xs font-semibold block mb-1 text-muted-foreground">{t("solution_support.subject", "Subject")}</label>
            <Input required value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder={t("solution_support.subject_ph", "Short summary")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">{t("solution_support.category", "Category")}</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`solution_support.cat.${c}`, c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">{t("solution_support.priority", "Priority")}</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{t(`solution_support.prio.${p}`, p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1 text-muted-foreground">{t("solution_support.message", "Message")}</label>
            <Textarea required rows={7} value={message} onChange={(e) => setMessage(e.target.value)} onPaste={onPaste}
              placeholder={t("solution_support.message_ph", "Describe your question, issue or suggestion. You can paste a screenshot.")} />
            {config?.aiOrganize && (
              <div className="flex items-center gap-2 mt-1.5">
                <Button type="button" variant="outline" size="sm" disabled={organizing || !message.trim()} onClick={() => void organize()}>
                  {organizing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {t("solution_support.organize", "Organize with AI")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("solution_support.organize_hint", "Turns your note into a tidy summary for the solution team.")}
                </span>
              </div>
            )}
          </div>

          {aiSummary && (
            <div>
              <label className="text-xs font-semibold block mb-1 text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {t("solution_support.ai_summary", "AI summary (editable, sent alongside your note)")}
              </label>
              <Textarea rows={6} value={aiSummary} onChange={(e) => setAiSummary(e.target.value)} className="text-sm" />
            </div>
          )}

          <LinksField links={links} onChange={setLinks} />
          <AttachmentBar files={files} onChange={setFiles} />

          {config && !config.configured && (
            <p className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
              {t("solution_support.not_configured", "The solution desk connection is not configured, so this request will be saved here but not delivered. Set SOLUTION_SUPPORT_TOKEN on the API server.")}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submit.isPending || !subject.trim() || !message.trim()}>
            {submit.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {t("solution_support.send", "Send request")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Thread panel ──────────────────────────────────────────────────────── */

function TicketThread({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  // Vendor replies arrive by email today — a staff member logs them here so the
  // thread stays whole. Remove this toggle once a pull channel exists.
  const [asVendor, setAsVendor] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["solution-support", ticketId],
    queryFn: () => json<{ ticket: Ticket; messages: Message[] }>(`/api/v1/solution-support/${ticketId}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["solution-support", ticketId] });
    qc.invalidateQueries({ queryKey: ["solution-support"] });
  };

  const send = useMutation({
    mutationFn: () => json(`/api/v1/solution-support/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: reply, attachments: files, senderType: asVendor ? "solution" : "admin" }),
    }),
    onSuccess: () => { setReply(""); setFiles([]); invalidate(); },
    onError: (e: Error) => toast({ title: t("solution_support.send_failed", "Failed to send"), description: e.message, variant: "destructive" }),
  });

  const retry = useMutation({
    mutationFn: () => json<Ticket>(`/api/v1/solution-support/${ticketId}/retry-push`, { method: "POST" }),
    onSuccess: (ticket) => {
      invalidate();
      toast(ticket.push_status === "sent"
        ? { title: t("solution_support.retry_ok", "Delivered to the solution team") }
        : { title: t("solution_support.retry_failed", "Still not delivered"), description: ticket.push_error ?? undefined, variant: "destructive" as const });
    },
    onError: (e: Error) => toast({ title: t("solution_support.retry_failed", "Still not delivered"), description: e.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => json(`/api/v1/solution-support/${ticketId}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: invalidate,
  });

  const ticket = data?.ticket;

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-base">
            <span className="font-mono text-xs text-primary mr-2">{ticket?.ticket_ref}</span>
            {ticket?.subject}
          </SheetTitle>
          {ticket && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ticket.status] ?? ""}`}>
                {t(`solution_support.status.${ticket.status}`, ticket.status)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                {t(`solution_support.prio.${ticket.priority}`, ticket.priority)}
              </span>
              <PushBadge status={ticket.push_status} />
              <Select value={ticket.status} onValueChange={(v) => setStatus.mutate(v)}>
                <SelectTrigger className="h-7 text-xs w-36 ml-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`solution_support.status.${s}`, s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {ticket?.push_status === "failed" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 space-y-1.5">
              <p className="font-medium inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> {t("solution_support.not_delivered_title", "This request has not reached the solution team")}
              </p>
              {ticket.push_error && <p className="text-xs font-mono opacity-80 break-all">{ticket.push_error}</p>}
              <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
                {retry.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                {t("solution_support.retry", "Retry delivery")}
              </Button>
            </div>
          )}

          {ticket && ticket.links.length > 0 && <LinksField links={ticket.links} readOnly />}

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-10">{t("common.loading", "Loading…")}</p>
          ) : (
            (data?.messages ?? []).map((m) => (
              <div key={m.id} className={m.sender_type === "admin" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                  m.sender_type === "admin" ? "bg-primary/10" : "bg-muted"
                }`}>
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                    <span className="font-medium">{m.sender_name ?? (m.sender_type === "admin" ? t("solution_support.us", "Us") : t("solution_support.vendor", "Solution team"))}</span>
                    <span>{formatDateTime(m.created_at)}</span>
                    {m.sender_type === "admin" && m.push_status !== "sent" && <PushBadge status={m.push_status} />}
                  </div>
                  {m.message}
                  {m.attachments.length > 0 && <div className="mt-2"><AttachmentBar files={m.attachments} readOnly /></div>}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t px-5 py-3 space-y-2">
          <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={asVendor
              ? t("solution_support.reply_vendor_ph", "Record the solution team's reply…")
              : t("solution_support.reply_ph", "Write a follow-up to the solution team…")} />
          <AttachmentBar files={files} onChange={setFiles} />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={asVendor} onChange={(e) => setAsVendor(e.target.checked)} />
              {t("solution_support.log_vendor_reply", "Log a reply received from the solution team")}
            </label>
            <Button size="sm" className="ml-auto" disabled={send.isPending || !reply.trim()} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {asVendor ? t("solution_support.log", "Log") : t("solution_support.send_reply", "Send")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

/** 서버가 정렬할 수 있는 컬럼(api-server routes/solution-support.ts 의
 *  SUPPORT_SORT 와 1:1). `last_activity` 는 화면에 컬럼이 없는 기본 정렬 키다. */
const SORTABLE_KEYS = [
  "ticket_ref", "subject", "category", "status", "priority",
  "push_status", "last_message_at", "created_at", "updated_at",
];

export default function SolutionSupportPage() {
  const { t } = useTranslation();
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [push, setPush] = useState(ALL);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["solution-support", "config"],
    queryFn: () => json<DeskConfig>("/api/v1/solution-support/config"),
  });

  const filters = {
    q: q || undefined,
    status: status === ALL ? undefined : status,
    category: category === ALL ? undefined : category,
    push_status: push === ALL ? undefined : push,
    ...(showDeleted ? { deleted: "only" } : {}),
  };
  const hasFilters = !!q || status !== ALL || category !== ALL || push !== ALL;
  const resetFilters = () => { setQ(""); setStatus(ALL); setCategory(ALL); setPush(ALL); };

  const { toast } = useToast();
  // 크론이 5분마다 당기지만, 답변을 기다리는 사람에게 5분은 길다.
  const sync = useMutation({
    mutationFn: () => json<{ inserted: number; skipped: number }>("/api/v1/solution-support/sync", { method: "POST" }),
    onSuccess: (r) => {
      invalidate();
      toast({
        title: r.inserted > 0
          ? t("solution_support.sync_found", "{{count}} new replies", { count: r.inserted })
          : t("solution_support.sync_none", "No new replies"),
      });
    },
    onError: (e: Error) => toast({ title: t("solution_support.sync_failed", "Could not reach the solution desk"), description: e.message, variant: "destructive" }),
  });

  const { rows, total, isLoading, server, invalidate } = useServerList<Ticket>(
    "/api/v1/solution-support",
    // 기본 정렬 = 마지막 활동 내림차순: 새로 쓴 글과 방금 고친 글이 위로 온다.
    { filters, sortableKeys: SORTABLE_KEYS, defaultSort: { key: "last_activity", dir: "desc" } },
  );

  const columns: ColumnDef<Ticket>[] = useMemo(
    () => [
      {
        key: "ticket_ref",
        header: "solution_support.col_ref",
        defaultWidth: 140,
        cell: (tk) => (
          <button onClick={() => setSelected(tk.id)}
            className="font-mono text-xs font-semibold text-primary hover:underline">
            {tk.ticket_ref}
          </button>
        ),
      },
      {
        key: "subject",
        header: "solution_support.col_subject",
        hideable: false,
        defaultWidth: 360,
        cell: (tk) => (
          <button onClick={() => setSelected(tk.id)} className="font-medium hover:underline text-left">
            {tk.subject}
          </button>
        ),
      },
      {
        key: "category",
        header: "solution_support.col_category",
        defaultWidth: 120,
        cell: (tk) => (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {t(`solution_support.cat.${tk.category}`, tk.category)}
          </span>
        ),
        csv: (tk) => tk.category,
      },
      {
        key: "status",
        header: "solution_support.col_status",
        defaultWidth: 100,
        cell: (tk) => (
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[tk.status] ?? ""}`}>
            {t(`solution_support.status.${tk.status}`, tk.status)}
          </span>
        ),
        csv: (tk) => tk.status,
      },
      {
        key: "priority",
        header: "solution_support.col_priority",
        defaultWidth: 90,
        cell: (tk) => (
          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[tk.priority] ?? ""}`}>
            {t(`solution_support.prio.${tk.priority}`, tk.priority)}
          </span>
        ),
        csv: (tk) => tk.priority,
      },
      {
        key: "push_status",
        header: "solution_support.col_push",
        defaultWidth: 110,
        cell: (tk) => <PushBadge status={tk.push_status} />,
        csv: (tk) => tk.push_status,
      },
      {
        key: "message_count",
        header: "solution_support.col_messages",
        align: "right",
        defaultWidth: 80,
        sortable: false,
        cell: (tk) => <span className="text-muted-foreground">{tk.message_count ?? 0}</span>,
      },
      {
        key: "last_message_at",
        header: "solution_support.col_last_message",
        defaultWidth: 130,
        cell: (tk) => (
          <span className="text-muted-foreground">
            {tk.last_message_at ? formatDate(tk.last_message_at) : "—"}
          </span>
        ),
        csv: (tk) => tk.last_message_at ?? "",
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 60,
        cell: (tk) => (
          <button onClick={() => setSelected(tk.id)}
            className="p-1.5 rounded hover:bg-muted transition-colors" title={tk.subject}>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <div className="p-6">
        {/* 헤더 한 줄 + 툴바 한 줄. 부제는 넓은 화면에서만 남은 자리에 흘려 넣고
            좁아지면 숨긴다 — 줄바꿈을 유발해 두 줄 구성을 깨는 유일한 요소였다. */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-xl font-bold tracking-tight shrink-0">{t("solution_support.title", "Solution Support")}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{total} {t("common.total")}</span>
            <p className="hidden xl:block text-sm text-muted-foreground truncate">
              · {t("solution_support.subtitle", "Contact the solution team.")}
            </p>
          </div>
          <Button size="sm" className="h-8 shrink-0" onClick={() => setOpenNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("solution_support.new", "New request")}
          </Button>
        </div>

        {config && !config.configured && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-3">
            <span className="font-medium">{t("solution_support.not_connected", "Not connected to the solution desk.")}</span>{" "}
            {t("solution_support.not_connected_desc", "Requests are saved here but are not delivered yet.")}
          </div>
        )}

        <DataTable
          tableKey="solution-support"
          columns={columns}
          data={rows}
          server={server}
          isLoading={isLoading}
          rowKey={(tk) => tk.id}
          emptyText={t("solution_support.empty", "No requests yet.")}
          exportFileName="solution-support"
          selection={{ enable: true, resource: "solution-support", onChanged: invalidate }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarCompact
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox compact className="w-48" value={q} onChange={setQ}
                placeholder={t("solution_support.search_ph", "Search by reference, subject or text")} />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("solution_support.status_all", "All statuses")}</SelectItem>
                  {STATUSES.map((v) => (
                    <SelectItem key={v} value={v}>{t(`solution_support.status.${v}`, v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("solution_support.category_all", "All categories")}</SelectItem>
                  {CATEGORIES.map((v) => (
                    <SelectItem key={v} value={v}>{t(`solution_support.cat.${v}`, v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={push} onValueChange={setPush}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("solution_support.push_all", "All delivery states")}</SelectItem>
                  <SelectItem value="sent">{t("solution_support.push_sent", "Delivered")}</SelectItem>
                  <SelectItem value="queued">{t("solution_support.push_queued", "Pending")}</SelectItem>
                  <SelectItem value="failed">{t("solution_support.push_failed", "Not delivered")}</SelectItem>
                </SelectContent>
              </Select>
              <ResetFiltersButton show={hasFilters} onClick={resetFilters} />
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {t("solution_support.sync", "Check for replies")}
              </Button>
            </div>
          }
        />
      </div>

      <NewRequestDialog open={openNew} onClose={() => setOpenNew(false)} config={config} />
      {selected !== null && <TicketThread ticketId={selected} onClose={() => setSelected(null)} />}
    </Layout>
  );
}
