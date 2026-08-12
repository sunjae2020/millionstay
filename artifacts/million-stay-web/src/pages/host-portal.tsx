import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Home as HomeIcon, LogOut, CheckCircle2, Clock, AlertCircle, XCircle,
  FileImage, Plus, Upload, Globe, ShieldCheck, Landmark, Trash2, FileEdit, Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BrandMark } from "../components/brand-mark";
import {
  getHomestayToken, clearHomestayToken, fetchHostMe, uploadHostDocument,
  setLandingActive, submitDraft, updateCompliance, updateBank, HomestayApiError,
  type HomestayApplication, type HomestayDocument, type HomestayWwccRecord,
} from "@/lib/homestay-api";
import { formatPersonName } from "@/lib/nameFormat";

const STATUS_META: Record<string, { color: string; icon: typeof CheckCircle2; key: string }> = {
  Draft: { color: "text-gray-700 bg-gray-50 border-gray-200", icon: FileEdit, key: "draft" },
  Submitted: { color: "text-blue-700 bg-blue-50 border-blue-200", icon: Clock, key: "submitted" },
  UnderReview: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock, key: "under_review" },
  DocsRequested: { color: "text-orange-700 bg-orange-50 border-orange-200", icon: AlertCircle, key: "docs_requested" },
  Approved: { color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2, key: "approved" },
  Rejected: { color: "text-red-700 bg-red-50 border-red-200", icon: XCircle, key: "rejected" },
};

const GENERAL_DOC_TYPES = ["id", "proof_of_address", "wwcc", "property_photo", "other"];

/** Returns true if a YYYY-MM-DD date is in the past or within the next 30 days. */
function isExpiringSoon(date?: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 30);
  return d <= threshold;
}

function emptyWwcc(): HomestayWwccRecord {
  return { name: "", wwcc_number: "", expiry_date: "", verified: false };
}

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
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

  // Draft finish form
  const [finishAgree, setFinishAgree] = useState(false);
  const [finishSignature, setFinishSignature] = useState("");
  const [finishBusy, setFinishBusy] = useState(false);

  // Compliance form
  const [wwccRecords, setWwccRecords] = useState<HomestayWwccRecord[]>([]);
  const [insProvider, setInsProvider] = useState("");
  const [insPolicy, setInsPolicy] = useState("");
  const [insExpiry, setInsExpiry] = useState("");
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [complianceSaved, setComplianceSaved] = useState(false);

  // Bank form
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [bankBusy, setBankBusy] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  const token = getHomestayToken();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("draft=saved")) {
      setDraftSavedNotice(true);
    }
  }, []);

  const logout = useCallback(() => {
    clearHomestayToken();
    setLocation("/host-login");
  }, [setLocation]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchHostMe();
      const a = res.application;
      setApp(a);
      setDocs(res.documents ?? []);
      setLandingActiveState(Boolean(a?.landing_active));
      // Hydrate editable sections
      setWwccRecords(Array.isArray(a?.wwcc_records) ? a.wwcc_records : []);
      setInsProvider(a?.insurance_provider ?? "");
      setInsPolicy(a?.insurance_policy_no ?? "");
      setInsExpiry(a?.insurance_expiry ?? "");
      setBankName(a?.bank_name ?? "");
      setBankAccountName(a?.bank_account_name ?? "");
      setBankBsb(a?.bank_bsb ?? "");
      setBankAccountNumber(a?.bank_account_number ?? "");
      setBankSwift(a?.bank_swift ?? "");
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

  const handleFinishDraft = async () => {
    if (!finishAgree || !finishSignature.trim()) return;
    setFinishBusy(true);
    setError(null);
    try {
      await submitDraft({ agreement_accepted: true, signature_name: finishSignature.trim() });
      setDraftSavedNotice(false);
      setFinishAgree(false);
      setFinishSignature("");
      await load();
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 401) { logout(); return; }
      setError(err instanceof Error ? err.message : t("homestay.portal.submit_failed"));
    } finally {
      setFinishBusy(false);
    }
  };

  const updateWwcc = (i: number, patch: Partial<HomestayWwccRecord>) =>
    setWwccRecords((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSaveCompliance = async () => {
    setComplianceBusy(true);
    setComplianceSaved(false);
    setError(null);
    try {
      const cleaned = wwccRecords.filter((r) => r.name.trim() || r.wwcc_number.trim() || r.expiry_date);
      const res = await updateCompliance({
        wwcc_records: cleaned,
        insurance_provider: insProvider.trim(),
        insurance_policy_no: insPolicy.trim(),
        insurance_expiry: insExpiry || undefined,
      });
      setApp(res.application);
      setWwccRecords(Array.isArray(res.application?.wwcc_records) ? res.application.wwcc_records : cleaned);
      setComplianceSaved(true);
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 401) { logout(); return; }
      setError(err instanceof Error ? err.message : t("homestay.portal.compliance_failed"));
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleSaveBank = async () => {
    setBankBusy(true);
    setBankSaved(false);
    setError(null);
    try {
      const res = await updateBank({
        bank_name: bankName.trim(),
        bank_account_name: bankAccountName.trim(),
        bank_bsb: bankBsb.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_swift: bankSwift.trim(),
      });
      setApp(res.application);
      setBankSaved(true);
    } catch (err) {
      if (err instanceof HomestayApiError && err.status === 401) { logout(); return; }
      setError(err instanceof Error ? err.message : t("homestay.portal.bank_failed"));
    } finally {
      setBankBusy(false);
    }
  };

  if (!token) return null;

  const status = app?.status ?? "Submitted";
  const meta = STATUS_META[status] ?? STATUS_META.Submitted!;
  const StatusIcon = meta.icon;
  const isApproved = status === "Approved";
  const isDraft = status === "Draft";
  const docTypeOf = (d: HomestayDocument) => d.doc_type ?? d.document_type ?? "";
  const requestedDocs = app?.requested_docs ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <BrandMark className="h-8 w-auto" />
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

            {draftSavedNotice && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> {t("homestay.portal.draft_saved_notice")}
              </div>
            )}

            {/* Draft: complete & submit banner */}
            {isDraft && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <div className="flex items-start gap-3">
                  <FileEdit className="h-6 w-6 shrink-0 mt-0.5 text-amber-600" />
                  <div className="flex-1">
                    <h2 className="font-bold text-lg text-amber-800">{t("homestay.portal.draft_banner_title")}</h2>
                    <p className="text-sm mt-1 text-amber-700">{t("homestay.portal.draft_banner_desc")}</p>
                    <div className="mt-4 space-y-3">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={finishAgree} onChange={(e) => setFinishAgree(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-primary" />
                        <span className="text-sm text-amber-800">{t("homestay.portal.draft_agreement")}</span>
                      </label>
                      <div className="max-w-sm">
                        <Input value={finishSignature} onChange={(e) => setFinishSignature(e.target.value)}
                          placeholder={t("homestay.portal.draft_signature_placeholder")} className="h-10 bg-white" />
                      </div>
                      <Button type="button" onClick={handleFinishDraft}
                        disabled={!finishAgree || !finishSignature.trim() || finishBusy}
                        className="bg-primary hover:bg-primary/90 text-white font-semibold">
                        {finishBusy ? t("homestay.portal.submitting") : t("homestay.portal.draft_submit")}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
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
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/10 transition-all text-center">
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
                      <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
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

            {/* Compliance */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{t("homestay.portal.compliance_title")}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t("homestay.portal.compliance_sub")}</p>
                </div>
              </div>

              {/* WWCC records */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-700">{t("homestay.portal.wwcc_title")}</h4>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setWwccRecords((prev) => [...prev, emptyWwcc()])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("homestay.portal.wwcc_add")}
                  </Button>
                </div>
                <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {t("homestay.portal.wwcc_note")}
                </p>
                {wwccRecords.length === 0 ? (
                  <p className="text-sm text-gray-400">{t("homestay.portal.wwcc_empty")}</p>
                ) : (
                  <div className="space-y-3">
                    {wwccRecords.map((r, i) => {
                      const expiring = isExpiringSoon(r.expiry_date);
                      return (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-gray-50 rounded-xl p-3">
                          <div className="sm:col-span-4">
                            <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.portal.wwcc_name")}</label>
                            <Input value={r.name} onChange={(e) => updateWwcc(i, { name: e.target.value })} className="h-10 bg-white" />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.portal.wwcc_number")}</label>
                            <Input value={r.wwcc_number} onChange={(e) => updateWwcc(i, { wwcc_number: e.target.value })} className="h-10 bg-white" />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-gray-500 mb-1">{t("homestay.portal.wwcc_expiry")}</label>
                            <Input type="date" value={r.expiry_date} onChange={(e) => updateWwcc(i, { expiry_date: e.target.value })}
                              className={`h-10 bg-white ${expiring ? "border-red-400 text-red-600" : ""}`} />
                          </div>
                          <div className="sm:col-span-1 flex items-center pb-2.5">
                            {r.verified ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600" title={t("homestay.portal.wwcc_verified")}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">{t("homestay.portal.wwcc_unverified")}</span>
                            )}
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <button type="button" onClick={() => setWwccRecords((prev) => prev.filter((_, idx) => idx !== i))}
                              className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Insurance */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.ins_provider")}</label>
                  <Input value={insProvider} onChange={(e) => setInsProvider(e.target.value)} className="h-10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.ins_policy")}</label>
                  <Input value={insPolicy} onChange={(e) => setInsPolicy(e.target.value)} className="h-10" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.ins_expiry")}</label>
                  <Input type="date" value={insExpiry} onChange={(e) => setInsExpiry(e.target.value)}
                    className={`h-10 ${isExpiringSoon(insExpiry) ? "border-red-400 text-red-600" : ""}`} />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <Button type="button" onClick={handleSaveCompliance} disabled={complianceBusy}
                  className="bg-primary hover:bg-primary/90 text-white">
                  {complianceBusy ? t("homestay.portal.saving") : t("homestay.portal.save_compliance")}
                </Button>
                {complianceSaved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {t("homestay.portal.saved")}</span>}
              </div>
            </div>

            {/* Bank details */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{t("homestay.portal.bank_title")}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t("homestay.portal.bank_helper")}</p>
                </div>
              </div>

              {isApproved ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.bank_name")}</label>
                      <Input value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.bank_account_name")}</label>
                      <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.bank_bsb")}</label>
                      <Input value={bankBsb} onChange={(e) => setBankBsb(e.target.value)} placeholder="000-000" className="h-10" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.bank_account_number")}</label>
                      <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("homestay.portal.bank_swift")}</label>
                      <Input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} className="h-10" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <Button type="button" onClick={handleSaveBank} disabled={bankBusy}
                      className="bg-primary hover:bg-primary/90 text-white">
                      {bankBusy ? t("homestay.portal.saving") : t("homestay.portal.save_bank")}
                    </Button>
                    {bankSaved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {t("homestay.portal.saved")}</span>}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                  <Lock className="h-4 w-4 text-gray-400" /> {t("homestay.portal.bank_locked")}
                </div>
              )}
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
                <SummaryRow label={t("homestay.apply.first_name")} value={formatPersonName(app?.first_name, app?.last_name)} />
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
