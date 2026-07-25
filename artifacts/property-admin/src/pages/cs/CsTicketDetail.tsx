import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiFetch";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/date";
import {
  ArrowLeft, Send, ImageIcon, X, Loader2, Clock, CheckCircle2, XCircle,
  AlertCircle, User, Calendar, Tag, Flag, RefreshCw, Shield, Eye, EyeOff, Wrench
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Open:       { label: "Open",        color: "bg-blue-100 text-blue-700",   icon: <Clock className="h-3 w-3" /> },
  InProgress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> },
  Resolved:   { label: "Resolved",    color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  Closed:     { label: "Closed",      color: "bg-gray-100 text-gray-500",   icon: <XCircle className="h-3 w-3" /> },
};

const CATEGORY_COLORS: Record<string, string> = {
  General:       "bg-purple-100 text-purple-700",
  Accommodation: "bg-orange-100 text-orange-700",
  Billing:       "bg-yellow-100 text-yellow-700",
  Maintenance:   "bg-red-100 text-red-700",
  Other:         "bg-gray-100 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-blue-50 text-blue-600",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

// Who opened the ticket — guest or one of the partner portals.
const REQUESTER_CONFIG: Record<string, { label: string; color: string }> = {
  guest:        { label: "Guest",        color: "bg-sky-100 text-sky-700" },
  agent:        { label: "Agent",        color: "bg-indigo-100 text-indigo-700" },
  owner:        { label: "Owner",        color: "bg-emerald-100 text-emerald-700" },
  service_host: { label: "Service Host", color: "bg-amber-100 text-amber-700" },
};

const STATUSES = ["Open", "InProgress", "Resolved", "Closed"] as const;
const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

// Human-readable names for the CS languages (used for the "Original (Korean)" labels).
const LANG_NAMES: Record<string, string> = {
  en: "English", ko: "한국어", ja: "日本語", zh: "中文", th: "ไทย", vi: "Tiếng Việt",
};
const langName = (code?: string | null) => (code ? LANG_NAMES[code] ?? code.toUpperCase() : "");

interface Message {
  id: number;
  ticket_id: number;
  sender_type: string;
  sender_id: number;
  message: string;
  original_lang?: string | null;
  translations?: Record<string, string> | null;
  translation_status?: string | null;
  image_urls: string | null;
  is_internal: number;
  created_at: string;
}

interface TicketDetail {
  id: number;
  ticket_ref: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  booking_id: number | null;
  booking_ref: string | null;
  booking_status: string | null;
  work_order_id?: number | null;
  check_in_date: string | null;
  check_out_date: string | null;
  requester_type?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  customer_language?: string | null;
  translation_enabled?: boolean | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

async function fetchTicket(id: string) {
  const res = await apiFetch(`/api/v1/cs-tickets/${id}`);
  return res.json();
}

export default function CsTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  // The admin composes in their portal UI language; the backend translates the
  // reply into the ticket's customer_language. Normalise to a 2-letter code.
  const adminLang = (i18n.language || "en").slice(0, 2);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cs-ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const ticket: TicketDetail | undefined = data?.data;

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setPriority(ticket.priority);
    }
  }, [ticket?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<{ status: string; priority: string }>) => {
      const res = await apiFetch(`/api/v1/cs-tickets/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cs-ticket", id] });
      qc.invalidateQueries({ queryKey: ["admin-cs-tickets"] });
      toast({ title: t('csticket.toast_ticket_updated', 'Ticket updated') });
    },
    onError: () => toast({ title: t('csticket.toast_error', 'Error'), description: t('csticket.toast_update_failed', 'Failed to update ticket.'), variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/cs-tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: reply.trim(),
          image_urls: images.map(i => i.url),
          is_internal: isInternal,
          lang: adminLang,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      setReply("");
      setImages([]);
      qc.invalidateQueries({ queryKey: ["admin-cs-ticket", id] });
      qc.invalidateQueries({ queryKey: ["admin-cs-tickets"] });
    },
    onError: () => toast({ title: t('csticket.toast_error', 'Error'), description: t('csticket.toast_send_failed', 'Failed to send message.'), variant: "destructive" }),
  });

  const [showWoPicker, setShowWoPicker] = useState(false);
  const [woCategory, setWoCategory] = useState("cleaning");
  const createWorkOrderMutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await apiFetch(`/api/v1/cs-tickets/${id}/create-work-order`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category }),
      });
      return res.json();
    },
    onSuccess: () => { setShowWoPicker(false); qc.invalidateQueries({ queryKey: ["admin-cs-ticket", id] }); },
  });

  const retranslateMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const res = await apiFetch(`/api/v1/cs-tickets/${id}/messages/${messageId}/retranslate`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cs-ticket", id] });
    },
    onError: () => toast({ title: t('csticket.toast_error', 'Error'), description: t('csticket.toast_retranslate_failed', 'Failed to retranslate.'), variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 5 - images.length)) {
        const formData = new FormData();
        formData.append("image", file);
        const token = localStorage.getItem("ms_auth_token");
        const res = await fetch("/api/v1/cs/admin/upload-image", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const j = await res.json();
        if (j.success) setImages(prev => [...prev, { url: j.url }]);
      }
    } catch {
      toast({ title: t('csticket.toast_upload_failed', 'Upload failed'), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <p className="text-gray-500">{t('csticket.not_found', 'Ticket not found.')}</p>
          <Button onClick={() => navigate("/cs/tickets")} className="mt-4">{t('csticket.back_to_tickets', 'Back to CS Tickets')}</Button>
        </div>
      </Layout>
    );
  }

  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.Open;

  return (
    <Layout>
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <button onClick={() => navigate("/cs/tickets")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: Conversation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-mono text-gray-400">{ticket.ticket_ref}</span>
                  {(() => {
                    const rkey = REQUESTER_CONFIG[ticket.requester_type ?? "guest"] ? (ticket.requester_type ?? "guest") : "guest";
                    const rc = REQUESTER_CONFIG[rkey];
                    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>{t(`csticket.requester_${rkey}` as any, rc.label)}</span>;
                  })()}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {ticket.category}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                    {st.icon}{(() => {
                      const sl = (ticket.status ?? "open").toLowerCase();
                      return t(`csticket.status_${sl === "inprogress" ? "in_progress" : sl}` as any, st.label);
                    })()}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority ?? ""] ?? ""}`}>
                    {t(`csticket.priority_${(ticket.priority ?? "normal").toLowerCase()}` as any, ticket.priority ?? "")}
                  </span>
                </div>
                <h1 className="text-lg font-bold text-gray-900">{ticket.subject}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  {t('common.created_at')}: {formatDateTime(ticket.created_at)} · {t('common.updated_at')}: {formatDateTime(ticket.updated_at)}
                </p>
              </div>
            </div>

            {/* Maintenance → work order bridge (Phase 3) */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              {ticket.work_order_id ? (
                <div className="text-sm text-gray-600 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-primary" />
                  {t('csticket.work_order_linked', 'Work order created')} ·
                  <button className="text-primary hover:underline" onClick={() => navigate(`/maintenance/work-orders/${ticket.work_order_id}`)}>#{ticket.work_order_id}</button>
                </div>
              ) : !showWoPicker ? (
                <Button size="sm" variant="outline" onClick={() => setShowWoPicker(true)} className="gap-1.5">
                  <Wrench className="h-3.5 w-3.5" /> {t('csticket.create_work_order', 'Create work order')}
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={woCategory} onChange={(e) => setWoCategory(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                    {["cleaning", "plumbing", "electrical", "general", "inspection", "hvac", "gardening", "pest"].map((c) => (
                      <option key={c} value={c}>{t(`service_host.specialty_${c}` as any, c)}</option>
                    ))}
                  </select>
                  <Button size="sm" disabled={createWorkOrderMutation.isPending} onClick={() => createWorkOrderMutation.mutate(woCategory)}>
                    {t('csticket.dispatch_to_partner', 'Create & dispatch')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowWoPicker(false)}>{t('common.cancel', 'Cancel')}</Button>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {ticket.messages.map(msg => {
              const isAdmin = msg.sender_type === "admin";
              const isInternalMsg = msg.is_internal === 1;
              const parsedImgs: string[] = (() => { try { return msg.image_urls ? JSON.parse(msg.image_urls) : []; } catch { return []; } })();
              // Admins read in English. Show the English copy as the primary text;
              // internal notes are never translated, so show them verbatim.
              const tr = msg.translations || {};
              const origLang = msg.original_lang || (isAdmin ? "en" : (ticket.customer_language || "en"));
              const adminText = isInternalMsg || origLang === "en" ? msg.message : (tr.en || msg.message);
              const hasOriginal = !isInternalMsg && origLang !== "en";
              const status = msg.translation_status;
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%]`}>
                    <div className={`flex items-center gap-2 mb-1 ${isAdmin ? "justify-end" : "justify-start"}`}>
                      {!isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                      )}
                      <span className="text-xs text-gray-400">
                        {isAdmin ? t('csticket.sender_admin', 'You (Admin)') : ticket.guest_name ?? t('csticket.sender_guest', 'Guest')} · {formatDateTime(msg.created_at)}
                        {isInternalMsg && <span className="ml-1.5 text-amber-500">({t('csticket.internal_note', 'Internal Note')})</span>}
                      </span>
                    </div>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isInternalMsg
                        ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-tr-sm"
                        : isAdmin
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                    }`}>
                      {adminText}
                    </div>
                    {/* Original (customer language) + translation status */}
                    {hasOriginal && (
                      <div className={`mt-1 rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-100 text-gray-500 ${isAdmin ? "ml-auto" : ""}`}>
                        <span className="font-medium text-gray-400">{t('cstranslate.original_label', 'Original')} · {langName(origLang)}: </span>
                        {msg.message}
                      </div>
                    )}
                    {!isInternalMsg && status === "failed" && (
                      <button
                        type="button"
                        onClick={() => retranslateMutation.mutate(msg.id)}
                        disabled={retranslateMutation.isPending}
                        className={`mt-1 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 ${isAdmin ? "ml-auto" : ""}`}
                      >
                        <RefreshCw className={`h-3 w-3 ${retranslateMutation.isPending ? "animate-spin" : ""}`} />
                        {t('cstranslate.failed_retry', 'Translation failed — retry')}
                      </button>
                    )}
                    {parsedImgs.length > 0 && (
                      <div className={`flex gap-2 mt-2 flex-wrap ${isAdmin ? "justify-end" : "justify-start"}`}>
                        {parsedImgs.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`attachment ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply Box */}
          <div className={`bg-white rounded-xl border shadow-sm p-4 ${isInternal ? "border-amber-200 bg-amber-50/30" : "border-gray-100"}`}>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIsInternal(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!isInternal ? "bg-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <Eye className="h-3.5 w-3.5" /> {t('csticket.tab_guest_reply', 'Guest Reply')}
              </button>
              <button
                type="button"
                onClick={() => setIsInternal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isInternal ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <EyeOff className="h-3.5 w-3.5" /> {t('csticket.tab_internal_note', 'Internal Note')}
              </button>
              <span className="text-xs text-gray-400 ml-1">
                {isInternal ? t('csticket.internal_note_hint', 'Not visible to guest') : t('csticket.guest_reply_hint', 'Visible to guest')}
              </span>
            </div>
            {!isInternal && ticket.translation_enabled !== false && (ticket.customer_language && ticket.customer_language !== "en") && (
              <p className="text-xs text-sky-600 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-3">
                {t('cstranslate.admin_compose_hint', 'Write in any language — the customer reads it auto-translated into {{lang}}.', { lang: langName(ticket.customer_language) })}
              </p>
            )}
            <Textarea
              placeholder={isInternal ? t('csticket.placeholder_internal_note', 'Add an internal note (not visible to guest)…') : t('csticket.placeholder_reply')}
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={3}
              className={`resize-none mb-3 ${isInternal ? "border-amber-200 bg-amber-50/20" : ""}`}
            />
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.url} alt="attachment" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || images.length >= 5}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {t('common.upload', 'Attach')}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <div className="flex-1" />
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={(!reply.trim() && images.length === 0) || sendMutation.isPending}
                className={`gap-2 ${isInternal ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-primary hover:bg-primary/90 text-white"}`}
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isInternal ? t('common.save', 'Save Note') : t('csticket.btn_send_reply')}
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-4">
          {/* Requester Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {(() => {
                const rkey = REQUESTER_CONFIG[ticket.requester_type ?? "guest"] ? (ticket.requester_type ?? "guest") : "guest";
                return t(`csticket.requester_${rkey}` as any, REQUESTER_CONFIG[rkey].label);
              })()}
            </h3>
            <p className="font-semibold text-gray-900 text-sm">{ticket.requester_name ?? ticket.guest_name ?? "—"}</p>
            <p className="text-gray-500 text-xs mt-0.5">{ticket.requester_email ?? ticket.guest_email ?? "—"}</p>
            {(ticket.requester_phone ?? ticket.guest_phone) && <p className="text-gray-500 text-xs mt-0.5">{ticket.requester_phone ?? ticket.guest_phone}</p>}
          </div>

          {/* Booking Info */}
          {ticket.booking_ref && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {t('csticket.label_booking')}
              </h3>
              <p className="font-semibold text-gray-900 text-sm">{ticket.booking_ref}</p>
              <p className="text-xs text-gray-500 mt-0.5">{ticket.booking_status}</p>
              {ticket.check_in_date && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(ticket.check_in_date)} →{" "}
                  {ticket.check_out_date ? formatDate(ticket.check_out_date) : "—"}
                </p>
              )}
            </div>
          )}

          {/* Status & Priority Controls */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5" /> {t('csticket.section_management', 'Management')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t('csticket.label_status')}</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => {
                      const sl = s.toLowerCase();
                      return (
                        <SelectItem key={s} value={s}>
                          {t(`csticket.status_${sl === "inprogress" ? "in_progress" : sl}` as any, STATUS_CONFIG[s]?.label ?? s)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t('csticket.label_priority')}</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{t(`csticket.priority_${p.toLowerCase()}`, p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full h-8 text-sm"
                disabled={updateMutation.isPending || (status === ticket.status && priority === ticket.priority)}
                onClick={() => updateMutation.mutate({ status, priority })}
              >
                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}
