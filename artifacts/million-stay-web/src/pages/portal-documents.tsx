import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useListMyDocuments, getListMyDocumentsQueryKey } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { PortalLayout } from "@/components/portal-layout";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { FileImage, CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getApiBase } from "@/lib/api-base";

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


export default function PortalDocuments() {
  const { t } = useTranslation();
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
        `${getApiBase()}/api/v1/guest/documents/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ doc_type: docType, file_name: file.name }),
        }
      );
      if (!res.ok) throw new Error(t("portal.documents.upload_failed", "Upload failed"));
      toast({
        title: t("portal.documents.upload_success_title", "Document uploaded"),
        description: t("portal.documents.upload_success_desc", "{{type}} uploaded successfully", { type: docType }),
      });
      refetch();
    } catch {
      toast({ title: t("portal.documents.upload_failed", "Upload failed"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!token) return null;

  return (
    <PortalLayout active="/portal/documents">
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
            {/* Upload new document */}
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-2">{t("portal.documents.upload_title")}</h2>
              <p className="text-xs text-gray-500 mb-4">
                {t("portal.documents.privacy_notice")}{" "}
                <Link href="/privacy-policy" className="text-primary hover:underline">{t("portal.documents.privacy_link")}</Link>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["id_card", "employment", "lease", "deposit", "other"].map((type) => (
                  <label key={type} className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/10 transition-all text-center">
                    <Plus className="h-5 w-5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">{t(`portal.documents.type_${type}`)}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => { if (e.target.files?.[0]) handleUpload(type, e.target.files[0]); }}
                    />
                  </label>
                ))}
              </div>
              {uploading && <p className="text-xs text-primary mt-3 animate-pulse">{t("portal.documents.uploading")}</p>}
            </div>

            {/* Document list */}
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              ) : docs.length === 0 ? (
                <div className="bg-white rounded-2xl border text-center py-16 text-gray-400">
                  <FileImage className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">{t("portal.documents.empty_title")}</p>
                  <p className="text-sm mt-1">{t("portal.documents.empty_sub")}</p>
                </div>
              ) : (
                docs.map((doc) => {
                  const statusKey = doc.status === "Approved" ? "status_approved" : doc.status === "Rejected" ? "status_rejected" : "status_pending";
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
                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                          <FileImage className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 capitalize">{t(`portal.documents.type_${doc.document_type}`, { defaultValue: doc.document_type.replace("_", " ") })}</p>
                          {doc.uploaded_at && (
                            <p className="text-xs text-gray-500">
                              {t("portal.documents.uploaded")} {format(new Date(doc.uploaded_at), "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={doc.status} label={t(`portal.documents.${statusKey}`)} icon={<StatusIcon className="h-3 w-3" />} />
                    </motion.div>
                  );
                })
              )}
            </div>
      </div>
    </PortalLayout>
  );
}
