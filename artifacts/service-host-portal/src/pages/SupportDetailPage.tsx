import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Send, ImageIcon, X, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, User,
} from "lucide-react";

// Conversation between this partner user and admin. Messages from admin have
// sender_type === "admin"; everything else is this user's own message.

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

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-purple-100 text-purple-700",
  Accommodation: "bg-orange-100 text-orange-700",
  Billing: "bg-yellow-100 text-yellow-700",
  Maintenance: "bg-red-100 text-red-700",
  Other: "bg-gray-100 text-gray-600",
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
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export default function SupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [reply, setReply] = useState("");
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: TicketDetail }>({
    queryKey: ["partner-cs-ticket", id],
    queryFn: () => apiGet(`/v1/partner/cs-tickets/${id}`),
    enabled: !!id,
    refetchInterval: 30000,
  });
  const ticket = data?.data;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const sendMutation = useMutation({
    mutationFn: async () =>
      apiPost(`/v1/partner/cs-tickets/${id}/messages`, {
        message: reply.trim(),
        image_urls: images.map((i) => i.url),
      }),
    onSuccess: () => {
      setReply("");
      setImages([]);
      setError(null);
      qc.invalidateQueries({ queryKey: ["partner-cs-ticket", id] });
      qc.invalidateQueries({ queryKey: ["partner-cs-tickets"] });
    },
    onError: (e: any) => setError(e?.message ?? t("support.send_failed", "Failed to send message.")),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 5 - images.length)) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await apiFetch("/v1/partner/cs/upload-image", { method: "POST", body: formData });
        const j = await res.json();
        if (j.success) setImages((prev) => [...prev, { url: j.url }]);
      }
    } catch {
      setError(t("support.upload_failed", "Image upload failed."));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto w-full space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto w-full text-center py-16">
          <p className="text-muted-foreground">{t("support.not_found", "Ticket not found.")}</p>
          <Link href="/support"><Button className="mt-4">{t("support.back", "Back to Support")}</Button></Link>
        </div>
      </Layout>
    );
  }

  const isClosed = ticket.status === "Closed";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto w-full">
        <button onClick={() => setLocation("/support")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-5 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("support.back", "Back to Support")}
        </button>

        {/* Header */}
        <div className="bg-card border border-card-border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_ref}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
              {t(`support.category_${ticket.category.toLowerCase()}`, ticket.category)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.Open}`}>
              <StatusIcon status={ticket.status} />{t(`support.status_${ticket.status.toLowerCase()}`, ticket.status)}
            </span>
          </div>
          <h1 className="text-lg font-bold text-foreground">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("support.submitted", "Submitted")} {formatDateTime(ticket.created_at)}</p>
        </div>

        {/* Conversation */}
        <div className="space-y-3 mb-4">
          {ticket.messages.map((msg) => {
            const isAdmin = msg.sender_type === "admin";
            const parsedImgs: string[] = (() => { try { return msg.image_urls ? JSON.parse(msg.image_urls) : []; } catch { return []; } })();
            // Show the message in the viewer's language as primary text, with the
            // English copy underneath (so the partner and admin share a reference).
            const viewerLang = (i18n.language || "en").slice(0, 2);
            const primaryText = textInLang(msg, viewerLang) ?? msg.message;
            const englishText = textInLang(msg, "en");
            const showEnglish = viewerLang !== "en" && englishText != null && englishText !== primaryText;
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[80%]">
                  <div className={`flex items-center gap-2 mb-1 ${isAdmin ? "justify-start" : "justify-end"}`}>
                    {isAdmin && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {isAdmin ? t("support.sender_admin", "{{appName}} Support") : t("support.sender_you", "You")} · {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isAdmin
                      ? "bg-card border border-card-border text-foreground rounded-tl-sm shadow-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  }`}>
                    {primaryText}
                  </div>
                  {showEnglish && (
                    <div className={`mt-1 rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap border ${
                      isAdmin ? "bg-muted/50 border-border text-muted-foreground" : "bg-primary/5 border-primary/10 text-muted-foreground"
                    }`}>
                      <span className="font-medium opacity-70">{t("support.english_label", "English")}: </span>
                      {englishText}
                    </div>
                  )}
                  {parsedImgs.length > 0 && (
                    <div className={`flex gap-2 mt-2 flex-wrap ${isAdmin ? "justify-start" : "justify-end"}`}>
                      {parsedImgs.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`${t("support.attachment_alt", "attachment")} ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity" />
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

        {/* Reply box */}
        {isClosed ? (
          <div className="bg-muted rounded-xl p-4 text-center text-sm text-muted-foreground">
            {t("support.closed_note", "This ticket is closed. Open a new ticket if you need further help.")}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl p-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg border border-destructive/20 mb-3">{error}</div>
            )}
            <Textarea
              placeholder={t("support.reply_placeholder", "Type your reply…")}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className="resize-none mb-3"
            />
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={img.url} alt={t("support.attachment_alt", "attachment")} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-accent cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {t("support.attach", "Attach")}
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading || images.length >= 5} onChange={handleFileChange} />
              </label>
              <div className="flex-1" />
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={(!reply.trim() && images.length === 0) || sendMutation.isPending}
                className="gap-2"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("support.send", "Send")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
