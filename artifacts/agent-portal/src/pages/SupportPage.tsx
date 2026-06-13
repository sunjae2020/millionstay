import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LifeBuoy, Plus, ChevronRight, Clock, AlertCircle, CheckCircle2, XCircle,
  ImageIcon, X, Loader2, MessageSquare,
} from "lucide-react";

// CS support tickets — a partner can open a ticket with admin. There is no
// peer-to-peer: every ticket is strictly between this user and admin.

const CATEGORIES = ["General", "Accommodation", "Billing", "Maintenance", "Other"] as const;

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

interface Ticket {
  id: number;
  ticket_ref: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function SupportPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>("General");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: Ticket[] }>({
    queryKey: ["partner-cs-tickets"],
    queryFn: () => apiGet("/v1/partner/cs-tickets"),
  });
  const tickets = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async () =>
      apiPost("/v1/partner/cs-tickets", {
        category,
        subject: subject.trim(),
        description: description.trim(),
        image_urls: images.map((i) => i.url),
      }),
    onSuccess: () => {
      setShowForm(false);
      setSubject("");
      setDescription("");
      setImages([]);
      setCategory("General");
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["partner-cs-tickets"] });
    },
    onError: (e: any) => setFormError(e?.message ?? t("support.create_failed", "Failed to create ticket.")),
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
      setFormError(t("support.upload_failed", "Image upload failed."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-primary" /> {t("support.title", "Support")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("support.subtitle", "Contact the MillionStay admin team. Only you and admin can see these messages.")}
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
          <Plus className="w-4 h-4" /> {t("support.new_ticket", "New ticket")}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-foreground">{t("support.new_ticket", "New ticket")}</h2>
          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg border border-destructive/20">{formError}</div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("support.category", "Category")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`support.category_${c.toLowerCase()}`, c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("support.subject", "Subject")}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("support.subject_placeholder", "Brief summary")}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("support.description", "Message")}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t("support.description_placeholder", "Describe how we can help…")}
              className="resize-none"
            />
          </div>
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                  <img src={img.url} alt="attachment" className="w-full h-full object-cover" />
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
            <Button variant="ghost" onClick={() => { setShowForm(false); setFormError(null); }}>{t("common.cancel", "Cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!subject.trim() || !description.trim() || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("support.submit", "Submit")}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 bg-card border border-card-border rounded-xl">
          {t("support.empty", "No tickets yet. Open one to contact admin.")}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/support/${ticket.id}`}>
              <a className="block bg-card border border-card-border rounded-xl p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_ref}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.Open}`}>
                        <StatusIcon status={ticket.status} />{t(`support.status_${ticket.status.toLowerCase()}`, ticket.status)}
                      </span>
                    </div>
                    <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {ticket.message_count} · {ticket.category}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </a>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
