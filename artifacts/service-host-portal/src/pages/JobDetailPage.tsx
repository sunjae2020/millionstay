import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { Layout } from "@/components/Layout";
import { apiFetch, apiGet } from "@/lib/api";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Camera,
  DollarSign,
  FileText,
  MapPin,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface Photo {
  id: number;
  file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
}

interface JobDetail {
  id: number;
  booking_id: number;
  name: string;
  service_type: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  currency: string;
  billing_trigger: string;
  frequency: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  booking: {
    id: number;
    booking_ref: string;
    booking_status: string;
    check_in_date: string | null;
    check_out_date: string | null;
    customer_notes: string | null;
  } | null;
  space: { id: number; name: string } | null;
  property: { id: number; name: string; address: string | null } | null;
  photos: Photo[];
  max_photos: number;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function triggerLabel(t: string) {
  if (t === "at_checkin") return "At Check-In";
  if (t === "at_checkout") return "At Check-Out";
  if (t === "at_booking") return "At Booking";
  return t;
}

export default function JobDetailPage() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = params?.id ? Number(params.id) : 0;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    if (!jobId) return;
    setLoading(true);
    try {
      const r = await apiGet<{ success: boolean; data: JobDetail }>(`/v1/service-host/jobs/${jobId}`);
      if (r.success) setJob(r.data);
      else setError("Failed to load job");
    } catch {
      setError("Failed to load job");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [jobId]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !job) return;
    const remaining = job.max_photos - job.photos.length;
    if (remaining <= 0) {
      setError(`Maximum of ${job.max_photos} photos already uploaded`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      selected.forEach((f) => fd.append("photos", f));
      const token = localStorage.getItem("partner_token");
      const r = await fetch(`/api/v1/service-host/jobs/${jobId}/photos`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setError(data?.error?.message ?? "Upload failed");
      } else {
        await load();
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(photoId: number) {
    if (!confirm("Delete this photo?")) return;
    try {
      const r = await apiFetch(`/v1/service-host/jobs/${jobId}/photos/${photoId}`, { method: "DELETE" });
      if (r.ok) await load();
      else setError("Failed to delete photo");
    } catch {
      setError("Failed to delete photo");
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to My Jobs
        </Link>

        {loading ? (
          <div className="space-y-3">
            <div className="h-32 bg-muted rounded-xl animate-pulse" />
            <div className="h-64 bg-muted rounded-xl animate-pulse" />
          </div>
        ) : !job ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-sm text-muted-foreground">{error || "Job not found"}</p>
          </div>
        ) : (
          <>
            {/* Header card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-foreground">{job.name}</h1>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {job.service_type === "one_time" ? "One-time" : "Recurring"}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {triggerLabel(job.billing_trigger)}
                      </span>
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        {job.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-2xl font-bold text-foreground">{parseFloat(job.total_price).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{job.currency}</span>
                  </div>
                  {job.quantity > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {job.quantity} × ${parseFloat(job.unit_price).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {job.booking && (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="font-medium text-foreground">{job.booking.booking_ref}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                        {job.booking.booking_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {formatDate(job.booking.check_in_date)} → {formatDate(job.booking.check_out_date)}
                    </div>
                  </>
                )}
                {job.property && (
                  <div className="flex items-center gap-2 text-muted-foreground md:col-span-2">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {job.property.name}
                      {job.property.address ? ` · ${job.property.address}` : ""}
                      {job.space ? ` · Room: ${job.space.name}` : ""}
                    </span>
                  </div>
                )}
              </div>

              {job.notes && (
                <p className="mt-4 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 italic">
                  {job.notes}
                </p>
              )}
            </div>

            {/* Photos card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Job Report Photos
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {job.photos.length} / {job.max_photos} uploaded · also visible to admin
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || job.photos.length >= job.max_photos}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>

              {error && <p className="text-sm text-destructive mb-3">{error}</p>}

              {job.photos.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                  <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No photos yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload up to {job.max_photos} photos to document this job</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {job.photos.map((p) => (
                    <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={p.thumbnail_url ?? p.file_url}
                        alt={p.caption ?? "Job photo"}
                        loading="lazy"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreviewUrl(p.file_url)}
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Lightbox */}
        {previewUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-full rounded-lg" />
          </div>
        )}
      </div>
    </Layout>
  );
}
