import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useListMyDocuments, getListMyDocumentsQueryKey } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { FileImage, CheckCircle2, Clock, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const DOC_STATUS: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  Pending: { color: "text-amber-600 bg-amber-50", icon: Clock, label: "Pending review" },
  Approved: { color: "text-green-700 bg-green-50", icon: CheckCircle2, label: "Verified" },
  Rejected: { color: "text-red-600 bg-red-50", icon: AlertCircle, label: "Rejected" },
};

interface Doc {
  id: number;
  document_type: string;
  file_url: string | null;
  status: string;
  uploaded_at: string | null;
}

function PortalSideMenu({ active }: { active: string }) {
  const [, setLocation] = useLocation();
  const { logout } = useAuthStore();
  const items = [
    { href: "/portal/bookings", label: "My Bookings", icon: "📋" },
    { href: "/portal/invoices", label: "My Invoices", icon: "🧾" },
    { href: "/portal/documents", label: "Documents", icon: "📎" },
    { href: "/portal/profile", label: "My Profile", icon: "👤" },
  ];
  return (
    <aside className="w-full md:w-56 shrink-0">
      <nav className="bg-white rounded-2xl border overflow-hidden">
        {items.map((item) => (
          <button key={item.href} onClick={() => setLocation(item.href)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-b last:border-b-0 transition-colors ${
              active === item.href ? "bg-orange-50 text-primary border-l-2 border-l-primary" : "text-gray-600 hover:bg-gray-50 hover:text-primary"
            }`}
          >
            <span>{item.icon}</span>{item.label}
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />
          </button>
        ))}
        <button onClick={() => { logout(); setLocation("/"); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          <span>🚪</span>Log out
        </button>
      </nav>
    </aside>
  );
}

export default function PortalDocuments() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!token) setLocation("/login?redirect=/portal/documents");
  }, [token, setLocation]);

  const { data, isLoading, refetch } = useListMyDocuments({
    query: { enabled: !!token, queryKey: getListMyDocumentsQueryKey() },
  });

  const docs: Doc[] = (data?.data ?? []) as Doc[];

  const handleUpload = async (docType: string, file: File) => {
    setUploading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? ""}/api/v1/guest/documents/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ doc_type: docType, file_name: file.name }),
        }
      );
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: "Document uploaded", description: `${docType} uploaded successfully` });
      refetch();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="bg-gradient-to-r from-[#c05010] via-[#e07828] to-[#c86820] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="font-cursive text-white/80 text-sm italic mb-1">Your account</p>
          <h1 className="text-2xl font-bold uppercase text-white tracking-wide">My Documents</h1>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          <PortalSideMenu active="/portal/documents" />
          <div className="flex-1 space-y-6">
            {/* Upload new document */}
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Upload New Document</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["passport", "visa", "enrollment", "bank_statement", "other"].map((type) => (
                  <label key={type} className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary hover:bg-orange-50 transition-all text-center">
                    <Plus className="h-5 w-5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600 capitalize">{type.replace("_", " ")}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => { if (e.target.files?.[0]) handleUpload(type, e.target.files[0]); }}
                    />
                  </label>
                ))}
              </div>
              {uploading && <p className="text-xs text-primary mt-3 animate-pulse">Uploading…</p>}
            </div>

            {/* Document list */}
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              ) : docs.length === 0 ? (
                <div className="bg-white rounded-2xl border text-center py-16 text-gray-400">
                  <FileImage className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No documents uploaded yet</p>
                  <p className="text-sm mt-1">Upload your passport to get started</p>
                </div>
              ) : (
                docs.map((doc) => {
                  const statusInfo = DOC_STATUS[doc.status] ?? DOC_STATUS["Pending"]!;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                          <FileImage className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 capitalize">{doc.document_type.replace("_", " ")}</p>
                          {doc.uploaded_at && (
                            <p className="text-xs text-gray-500">
                              Uploaded {format(new Date(doc.uploaded_at), "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
