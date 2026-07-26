import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { ArrowLeft, Send, ImageIcon, X, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiBase } from "@/lib/api-base";
import { APP_NAME } from "../lib/appName";

const BASE = `${getApiBase()}/api/v1`;
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("ms_guest_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function gFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers as Record<string, string> ?? {}) },
    ...opts,
  });
  if (!res.ok) { const j = await res.json(); throw j; }
  return res.json();
}

const STATUS_KEYS: Record<string, string> = {
  Open: "status_open", InProgress: "status_in_progress", Resolved: "status_resolved", Closed: "status_closed",
};
/* Render-time label helpers (never call t() at module scope) */
function statusLabel(t: TFunction, status: string): string {
  const k = STATUS_KEYS[status];
  return k ? t(`portal.cs.${k}`, status) : status;
}
function catLabel(t: TFunction, value: string): string {
  return t(`portal.cs.cat_${String(value).toLowerCase()}`, value);
}
function prioLabel(t: TFunction, value: string): string {
  return t(`portal.cs.prio_${String(value).toLowerCase()}`, value);
}
const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-amber-100 text-amber-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-500",
};
function StatusIcon({ status }: { status: string }) {
  if (status === "Open") return <Clock className="h-3 w-3" />;
  if (status === "InProgress") return <AlertCircle className="h-3 w-3" />;
  if (status === "Resolved") return <CheckCircle2 className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-blue-50 text-blue-600",
  High: "bg-orange-100 text-orange-600",
  Urgent: "bg-red-100 text-red-600",
};

const CATEGORY_COLORS: Record<string, string> = {
  General:       "bg-purple-100 text-purple-700",
  Accommodation: "bg-orange-100 text-orange-700",
  Billing:       "bg-yellow-100 text-yellow-700",
  Maintenance:   "bg-red-100 text-red-700",
  Other:         "bg-gray-100 text-gray-600",
};

interface Message {
  id: number;
  ticket_id: number;
  sender_type: string;
  sender_id: number;
  message: string;
  original_lang?: string | null;
  translations?: Record<string, string> | null;
  image_urls: string | null;
  created_at: string;
}

// Pick the message text in a given language: the original if it was written in
// that language, otherwise the cached translation (or null if unavailable).
function textInLang(msg: Message, lang: string): string | null {
  if ((msg.original_lang || "en") === lang) return msg.message;
  return msg.translations?.[lang] ?? null;
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
  booking: { booking_ref: string; booking_status: string; check_in_date: string; check_out_date: string } | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export default function PortalCsDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  // The guest reads the conversation in their current site language.
  const guestLang = (i18n.language || "en").slice(0, 2);
  const { token } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: TicketDetail }>({
    queryKey: ["cs-ticket", id],
    queryFn: () => gFetch(`/guest/cs-tickets/${id}`),
    enabled: !!token && !!id,
    refetchInterval: 30000,
  });

  const ticket = data?.data;

  useEffect(() => {
    if (!token) setLocation(`/login?redirect=/portal/cs/${id}`);
  }, [token, id, setLocation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      return gFetch(`/guest/cs-tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim(), image_urls: images.map(i => i.url) }),
      });
    },
    onSuccess: () => {
      setReply("");
      setImages([]);
      qc.invalidateQueries({ queryKey: ["cs-ticket", id] });
      qc.invalidateQueries({ queryKey: ["guest-cs-tickets"] });
    },
    onError: (e: any) => toast({ title: t("portal.cs.error", "Error"), description: e?.error?.message || e?.message || t("portal.cs.send_failed", "Failed to send message."), variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 5 - images.length)) {
        const formData = new FormData();
        formData.append("image", file);
        const tkn = localStorage.getItem("ms_guest_token");
        const res = await fetch(`${BASE}/cs/upload-image`, {
          method: "POST",
          headers: tkn ? { Authorization: `Bearer ${tkn}` } : {},
          body: formData,
        });
        const j = await res.json();
        if (j.success) setImages(prev => [...prev, { url: j.url, name: file.name }]);
      }
    } catch {
      toast({ title: t("portal.cs.upload_failed", "Upload failed"), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!token) return null;

  if (isLoading) {
    return (
      <PortalLayout active="/portal/cs">
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </PortalLayout>
    );
  }

  if (!ticket) {
    return (
      <PortalLayout active="/portal/cs">
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 text-center">
          <p className="text-gray-500">{t("portal.cs.not_found", "Inquiry not found.")}</p>
          <Link href="/portal/cs"><Button className="mt-4">{t("portal.cs.back_to_inquiries", "Back to Inquiries")}</Button></Link>
        </div>
      </PortalLayout>
    );
  }

  const stColor = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.Open;
  const stLabel = statusLabel(t, ticket.status);
  const isClosed = ticket.status === "Closed";

  return (
    <PortalLayout active="/portal/cs">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <button onClick={() => setLocation("/portal/cs")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-5 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("portal.cs.back_to_inquiries", "Back to Inquiries")}
        </button>

        {/* Ticket Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-mono text-gray-400">{ticket.ticket_ref}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {catLabel(t, ticket.category)}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stColor}`}>
                  <StatusIcon status={ticket.status} />{stLabel}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                  {prioLabel(t, ticket.priority)}
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">{ticket.subject}</h1>
              <p className="text-xs text-gray-400 mt-1">{t("portal.cs.submitted_on", "Submitted {{date}}", { date: formatDateTime(ticket.created_at) })}</p>
            </div>
          </div>

          {ticket.booking && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{t("portal.cs.related_booking", "Related booking:")} <strong>{ticket.booking.booking_ref}</strong> ({t("portal.cs.bst_" + String(ticket.booking.booking_status).toLowerCase(), ticket.booking.booking_status)})</span>
                {ticket.booking.check_in_date && (
                  <span className="text-gray-400">· {formatDate(ticket.booking.check_in_date)} → {ticket.booking.check_out_date ? formatDate(ticket.booking.check_out_date) : "—"}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Conversation */}
        <div className="space-y-3 mb-4">
          {ticket.messages.map((msg) => {
            const isGuest = msg.sender_type === "guest";
            const parsedImgs: string[] = (() => { try { return msg.image_urls ? JSON.parse(msg.image_urls) : []; } catch { return []; } })();
            // Show the message in the guest's language as the primary text, and
            // the English copy underneath (per "shown in their language and English").
            const primaryText = textInLang(msg, guestLang) ?? msg.message;
            const englishText = textInLang(msg, "en");
            const showEnglish = guestLang !== "en" && englishText != null && englishText !== primaryText;
            return (
              <div key={msg.id} className={`flex ${isGuest ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${isGuest ? "order-2" : "order-1"}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isGuest ? "justify-end" : "justify-start"}`}>
                    {!isGuest && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <span className="text-xs text-gray-400">
                      {isGuest ? t("portal.cs.sender_you", "You") : t("portal.cs.sender_support", "{{appName}} Support", { appName: APP_NAME })} · {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isGuest
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                  }`}>
                    {primaryText}
                  </div>
                  {showEnglish && (
                    <div className={`mt-1 rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap border ${
                      isGuest ? "bg-primary/5 border-primary/10 text-gray-600" : "bg-gray-50 border-gray-100 text-gray-500"
                    }`}>
                      <span className="font-medium opacity-70">{t("cstranslate.english_label", "English")}: </span>
                      {englishText}
                    </div>
                  )}
                  {parsedImgs.length > 0 && (
                    <div className={`flex gap-2 mt-2 flex-wrap ${isGuest ? "justify-end" : "justify-start"}`}>
                      {parsedImgs.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={t("portal.cs.attachment_n", "attachment {{n}}", { n: i + 1 })} className="h-24 w-24 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
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
        {isClosed ? (
          <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
            {t("portal.cs.closed_notice", "This inquiry is closed.")} <Link href="/portal/cs/new"><span className="text-primary font-medium cursor-pointer hover:underline">{t("portal.cs.submit_new_inquiry", "Submit a new inquiry")}</span></Link> {t("portal.cs.need_assistance", "if you need further assistance.")}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <Textarea
              placeholder={t("portal.cs.reply_placeholder", "Type your reply…")}
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={3}
              className="resize-none mb-3"
            />
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
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
                {t("portal.cs.photo", "Photo")}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <div className="flex-1" />
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={(!reply.trim() && images.length === 0) || sendMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white gap-2"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("portal.cs.send", "Send")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
