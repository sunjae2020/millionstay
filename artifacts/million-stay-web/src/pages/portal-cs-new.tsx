import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, X, Loader2, ImageIcon } from "lucide-react";
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

const CATEGORIES = ["General", "Accommodation", "Billing", "Maintenance", "Other"] as const;

interface Booking { id: number; booking_ref: string; booking_status: string; }

export default function PortalCsNew() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ category: "General", booking_id: "_none", subject: "", description: "" });
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/cs/new");
  }, [token, setLocation]);

  const { data: bookingsData } = useQuery<{ success: boolean; data: Booking[] }>({
    queryKey: ["my-bookings-cs"],
    queryFn: () => gFetch("/guest/bookings?limit=50"),
    enabled: !!token,
  });
  const bookings = bookingsData?.data ?? [];

  if (!token) return null;

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
        else toast({ title: "Upload failed", description: j?.error?.message || "Could not upload image.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Could not upload image. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: "Required fields", description: "Please fill in subject and description.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        image_urls: images.map(i => i.url),
      };
      if (form.booking_id && form.booking_id !== "_none") body.booking_id = Number(form.booking_id);
      const res = await gFetch<{ success: boolean; data: { id: number } }>("/guest/cs-tickets", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast({ title: "Inquiry submitted!", description: "We'll get back to you as soon as possible." });
      setLocation(`/portal/cs/${res.data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err?.error?.message || err?.message || "Failed to submit. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout active="/portal/cs">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <button onClick={() => setLocation("/portal/cs")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Inquiries
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">New Inquiry</h1>
          <p className="text-sm text-gray-500 mb-6">Tell us what's on your mind and we'll respond as soon as possible.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-red-500">*</span></Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Related Booking (optional)</Label>
                <Select value={form.booking_id} onValueChange={v => setForm(p => ({ ...p, booking_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select booking…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— No specific booking —</SelectItem>
                    {bookings.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.booking_ref} ({b.booking_status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Subject <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Brief description of your inquiry…"
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Message <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Please describe your inquiry in detail…"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments (optional, up to 5 images)</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-primary transition-colors"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ImageIcon className="h-5 w-5" /><span className="text-xs">Add</span></>}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <p className="text-xs text-gray-400">JPG, PNG, GIF up to 10MB each</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setLocation("/portal/cs")} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting} className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Inquiry
              </Button>
            </div>
          </form>
        </div>
      </div>
    </PortalLayout>
  );
}
