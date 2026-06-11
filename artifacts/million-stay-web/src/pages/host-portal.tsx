import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Home as HomeIcon, LogOut, CheckCircle2, Clock, AlertCircle, XCircle,
  FileImage, Plus, Upload, Globe,
} from "lucide-react";
import logoHorizontal from "@assets/06.OR_NB_horizontal_ver_1775381659303.png";
import {
  getHomestayToken, clearHomestayToken, fetchHostMe, uploadHostDocument,
  setLandingActive, HomestayApiError,
  type HomestayApplication, type HomestayDocument,
} from "@/lib/homestay-api";

const STATUS_META: Record<string, { color: string; icon: typeof CheckCircle2; key: string }> = {
  Submitted: { color: "text-blue-700 bg-blue-50 border-blue-200", icon: Clock, key: "submitted" },
  UnderReview: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock, key: "under_review" },
  DocsRequested: { color: "text-orange-700 bg-orange-50 border-orange-200", icon: AlertCircle, key: "docs_requested" },
  Approved: { color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2, key: "approved" },
  Rejected: { color: "text-red-700 bg-red-50 border-red-200", icon: XCircle, key: "rejected" },
};

const GENERAL_DOC_TYPES = ["id", "proof_of_address", "wwcc", "property_photo", "other"];

export default function HostPortal() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<HomestayApplication | null>(null);
  const [docs, setDocs] = useState<HomestayDocument[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [landingBusy, setLandingBusy] = useState(false);
  const [landingActive, setLandingActiveState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = getHomestayToken();

  const logout = useCallback(() => {
    clearHomestayToken();
    setLocation("/host-login");
  }, [setLocation]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchHostMe();
      setApp(res.application);
      setDocs(res.documents ?? []);
      setLandingActiveState(Boolean(res.application?.landing_active));
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : t("homestay.portal.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [logout, t]);

  useEffect(() => {
    if (!token) {
      setLocation("/host-login");
      return;
    }
    void load();
  }, [token, load, setLocation]);

  const handleUpload = async (docType: string, file: File) => {
    setUploadingType(docType);
    setError(null);
    try {
      await uploadHostDocument(docType, file);
      await load();
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 401) { logout(); return; }
      setError(err instanceof Error ? err.message : t("homestay.portal.upload_failed"));
    } finally {
      setUploadingType(null);
    }
  };

  const handleLandingToggle = async (active: boolean) => {
    setLandingBusy(true);
    setError(null);
    try {
      const res = await setLandingActive(active);
      setLandingActiveState(Boolean(res.landing_active));
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 401) { logout(); return; }
      setError(err instanceof Error ? err.message : t("homestay.portal.landing_failed"));
    } finally {
      setLandingBusy(false);
    }
  };

  if (!token) return null;

  const status = app?.status ?? "Submitted";
  const meta = STATUS_META[status] ?? STATUS_META.Submitted!;
  const StatusIcon = meta.icon;
  const isApproved = status === "Approved";
  const docTypeOf = (d: HomestayDocument) => d.doc_type ?? d.document_type ?? "";
  const requestedDocs = app?.requested_docs ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <img src={logoHorizontal} alt="MillionStay" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
              <HomeIcon className="h-4 w-4 text-primary" /> {t("homestay.portal.title")}
            </span>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium">
              <LogOut className="h-4 w-4" /> {t("homestay.portal.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </>
        ) : (
          <>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* Status banner */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-6 ${meta.color}`}>
              <div className="flex items-start gap-3">
                <StatusIcon className="h-6 w-6 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-lg">{t(`homestay.portal.status.${meta.key}`)}</h2>
                    {app?.application_ref && (
                      <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded">{app.application_ref}</span>
                    )}
                  </div>
                  <p className="text-sm mt-1 opacity-90">{t(`homestay.portal.status_desc.${meta.key}`)}</p>
                  <p className="text-xs mt-2 opacity-80">{t("homestay.portal.login_anytime")}</p>
                </div>
              </div>
            </motion.div>

            {/* Requested documents */}
            {status === "DocsRequested" && requestedDocs.length > 0 && (
              <div className="bg-white rounded-2xl border p-6">
                <h3 className="font-semibold text-gray-800 mb-1">{t("homestay.portal.requested_title")}</h3>
                <p className="text-sm text-gray-500 mb-4">{t("homestay.portal.requested_sub")}</p>
                <div className="space-y-2">
                  {requestedDocs.map((rd) => {
                    const fulfilled = docs.some((d) => docTypeOf(d) === rd);
                    return (
                      <div key={rd} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          {fulfilled
                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                            : <AlertCircle className="h-4 w-4 text-orange-500" />}
                          <span className="text-sm font-medium text-gray-700 capitalize">{rd.replace(/_/g, " ")}</span>
                        </div>
                        {fulfilled ? (
                          <span className="text-xs text-green-600 font-medium">{t("homestay.portal.fulfilled")}</span>
                        ) : (
                          <label className="text-xs font-medium text-primary cursor-pointer hover:underline flex items-center gap-1">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingType === rd ? t("homestay.portal.uploading") : t("homestay.portal.upload")}
                            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf"
                              onChange={(e) => { if (e.target.files?.[0]) handleUpload(rd, e.target.files[0]); }} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General document upload */}
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4">{t("homestay.portal.documents_title")}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {GENERAL_DOC_TYPES.map((type) => (
                  <label key={type}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary hover:bg-orange-50 transition-all text-center">
                    <Plus className="h-5 w-5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">{t(`homestay.portal.doc_type.${type}`)}</span>
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => { if (e.target.files?.[0]) handleUpload(type, e.target.files[0]); }} />
                  </label>
                ))}
              </div>
              {uploadingType && <p className="text-xs text-primary mt-3 animate-pulse">{t("homestay.portal.uploading")}</p>}

              {docs.length > 0 && (
                <div className="mt-5 space-y-2">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-2.5">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <FileImage className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 capitalize truncate">
                          {(docTypeOf(d) || "document").replace(/_/g, " ")}
                        </p>
                        {d.original_filename && <p className="text-xs text-gray-400 truncate">{d.original_filename}</p>}
                      </div>
                      {d.status && <span className="text-xs text-gray-500 capitalize shrink-0">{d.status}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Landing page activation (Approved only) */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{t("homestay.portal.landing_title")}</h3>
                  {isApproved ? (
                    <>
                      <p className="text-sm text-gray-500 mt-0.5">{t("homestay.portal.landing_sub_approved")}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <Switch checked={landingActive} disabled={landingBusy}
                          onCheckedChange={(v) => handleLandingToggle(v)} />
                        <span className="text-sm font-medium text-gray-700">
                          {landingActive ? t("homestay.portal.landing_on") : t("homestay.portal.landing_off")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 mt-0.5">{t("homestay.portal.landing_locked")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Application summary */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{t("homestay.portal.summary_title")}</h3>
                {status !== "Approved" && status !== "Rejected" && (
                  <Link href="/for-homestay-host" className="text-xs text-primary font-medium hover:underline">
                    {t("homestay.portal.edit")}
                  </Link>
                )}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <SummaryRow label={t("homestay.apply.first_name")} value={`${app?.first_name ?? ""} ${app?.last_name ?? ""}`.trim()} />
                <SummaryRow label={t("homestay.apply.email")} value={app?.email} />
                <SummaryRow label={t("homestay.apply.phone")} value={app?.phone} />
                <SummaryRow label={t("homestay.apply.address")} value={[app?.address, app?.suburb].filter(Boolean).join(", ")} />
                <SummaryRow label={t("homestay.apply.building_type")} value={app?.building_type} />
                <SummaryRow label={t("homestay.apply.nationality")} value={app?.nationality} />
                <SummaryRow label={t("homestay.apply.rooms_title")} value={app?.rooms ? String(app.rooms.length) : "0"} />
                <SummaryRow label={t("homestay.apply.residents_title")} value={app?.residents ? String(app.residents.length) : "0"} />
                <SummaryRow label={t("homestay.apply.packages_offered")}
                  value={(app?.packages_offered ?? []).map((p) => t(`homestay.opt.package.${p}`, p)).join(", ")} />
              </dl>
              {app?.profile_description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("homestay.apply.profile_description")}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{app.profile_description}</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-800 mt-0.5">{value}</dd>
    </div>
  );
}
