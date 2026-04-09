import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, Send, ImageIcon, X, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/v1";
function authHeaders() {
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Open:       { label: "Open",        color: "bg-blue-100 text-blue-700",   icon: <Clock className="h-3 w-3" /> },
  InProgress: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> },
  Resolved:   { label: "Resolved",    color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  Closed:     { label: "Closed",      color: "bg-gray-100 text-gray-500",   icon: <XCircle className="h-3 w-3" /> },
};

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
  image_urls: string | null;
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
  booking: { booking_ref: string; booking_status: string; check_in_date: string; check_out_date: string } | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export default function PortalCsDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { token, guest } = useAuthStore();
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
    onError: (e: any) => toast({ title: "Error", description: e?.error || "Failed to send message.", variant: "destructive" }),
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
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!token) { navigate(`/login?redirect=/portal/cs/${id}`); return null; }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 text-center">
          <p className="text-gray-500">Inquiry not found.</p>
          <Link href="/portal/cs"><Button className="mt-4">Back to Inquiries</Button></Link>
        </main>
        <Footer />
      </div>
    );
  }

  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.Open;
  const isClosed = ticket.status === "Closed";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <button onClick={() => navigate("/portal/cs")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-5 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Inquiries
        </button>

        {/* Ticket Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-mono text-gray-400">{ticket.ticket_ref}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ticket.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {ticket.category}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                  {st.icon}{st.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                  {ticket.priority}
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">{ticket.subject}</h1>
              <p className="text-xs text-gray-400 mt-1">Submitted {format(new Date(ticket.created_at), "dd MMM yyyy, hh:mm a")}</p>
            </div>
          </div>

          {ticket.booking && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Related booking: <strong>{ticket.booking.booking_ref}</strong> ({ticket.booking.booking_status})</span>
                {ticket.booking.check_in_date && (
                  <span className="text-gray-400">· {format(new Date(ticket.booking.check_in_date), "dd/MM/yyyy")} → {ticket.booking.check_out_date ? format(new Date(ticket.booking.check_out_date), "dd/MM/yyyy") : "—"}</span>
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
                      {isGuest ? "You" : "MillionStay Support"} · {format(new Date(msg.created_at), "dd/MM/yyyy hh:mm a")}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isGuest
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.message}
                  </div>
                  {parsedImgs.length > 0 && (
                    <div className={`flex gap-2 mt-2 flex-wrap ${isGuest ? "justify-end" : "justify-start"}`}>
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
        {isClosed ? (
          <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
            This inquiry is closed. <Link href="/portal/cs/new"><span className="text-primary font-medium cursor-pointer hover:underline">Submit a new inquiry</span></Link> if you need further assistance.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <Textarea
              placeholder="Type your reply…"
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
                Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <div className="flex-1" />
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={(!reply.trim() && images.length === 0) || sendMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white gap-2"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
