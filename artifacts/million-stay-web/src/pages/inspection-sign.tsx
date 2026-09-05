/**
 * 세대점검표 — tenant review & signature page (token link, no login).
 *
 * The tenant opens this on their phone at handover: they read each area group as
 * the inspector recorded it, agree or dispute item by item (a dispute can carry
 * a comment and their own photos), then draw one signature that closes the phase.
 *
 * Deliberately no account required — Korean lease tenants rarely have a portal
 * login, and requiring one at the door is how paper wins.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import {
  AlertCircle, Camera, Check, CheckCircle2, ChevronDown, ChevronRight,
  FileText, Loader2, Minus, TriangleAlert, X,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SignaturePad from "@/components/SignaturePad";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import {
  getInspection, respondToItem, signInspection, uploadInspectionPhoto,
  inspectionPdfUrl, InspectionError,
  type InspectionItemView, type InspectionView,
} from "@/lib/inspection-api";

const DEV_SITE = isDevelopmentSite();

const STATUS_ICON = {
  ok: { icon: Check, className: "text-green-600 bg-green-50 border-green-200" },
  defect: { icon: TriangleAlert, className: "text-red-600 bg-red-50 border-red-200" },
  na: { icon: Minus, className: "text-gray-500 bg-gray-50 border-gray-200" },
} as const;

export default function InspectionSign() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute("/inspection/:token");
  const token = params?.token ?? "";

  const [view, setView] = useState<InspectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getInspection(token, i18n.language);
      setView(data);
      setSignerName((prev) => prev || (data.meta?.tenant_name ?? ""));
      setLoadError(null);
    } catch (e) {
      const err = e instanceof InspectionError ? e : null;
      setLoadError({ code: err?.code ?? "error", message: err?.message ?? t("inspectionSign.load_failed") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, i18n.language]);

  const groups = useMemo(() => {
    if (!view) return [];
    const byKey = new Map<string, InspectionItemView[]>();
    for (const item of view.items) {
      const key = item.group_key ?? "other";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(item);
    }
    const ordered = view.groups.map((g) => ({ key: g.key, label: g.label, items: byKey.get(g.key) ?? [] }));
    const extras = [...byKey.entries()]
      .filter(([k]) => !view.groups.some((g) => g.key === k))
      .map(([k, items]) => ({ key: k, label: t("inspectionSign.group_other"), items }));
    return [...ordered, ...extras].filter((g) => g.items.length);
  }, [view, t]);

  const unanswered = useMemo(() => (view ? view.items.filter((i) => !i.response).length : 0), [view]);

  async function respond(item: InspectionItemView, decision: "agreed" | "disputed") {
    if (!view || view.signed) return;
    // Optimistic — the tenant is tapping through ~90 rows; a round trip per tap
    // would make the list feel broken on mobile data.
    setView((prev) => prev && {
      ...prev,
      items: prev.items.map((i) => (i.id === item.id ? { ...i, response: { decision, comment: comments[item.id] ?? null } } : i)),
    });
    try {
      await respondToItem(token, item.id, decision, comments[item.id]);
    } catch {
      void load();
    }
  }

  async function upload(file: File, itemId: number) {
    setUploading(itemId);
    try {
      const photo = await uploadInspectionPhoto(token, itemId, file);
      setView((prev) => prev && {
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, photos: [...i.photos, photo] } : i)),
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t("inspectionSign.upload_failed"));
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    setSubmitError(null);
    if (!signature) { setSubmitError(t("inspectionSign.err_signature")); return; }
    if (!consent) { setSubmitError(t("inspectionSign.err_consent")); return; }
    setSubmitting(true);
    try {
      await signInspection(token, signerName, signature);
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t("inspectionSign.err_submit"));
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-background">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}
      <main className="flex-1 w-full mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">{children}</main>
      {DEV_SITE ? <DevFooter /> : <Footer />}
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>,
    );
  }

  if (loadError) {
    return shell(
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">{t("inspectionSign.unavailable")}</h1>
        <p className="mt-2 text-muted-foreground">{loadError.message}</p>
      </div>,
    );
  }

  if (done || view?.signed) {
    return shell(
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="w-9 h-9 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">{t("inspectionSign.done_title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("inspectionSign.done_desc")}</p>
        <Button className="mt-6" onClick={() => openPreview({
          title: t("inspectionSign.download_pdf"),
          filename: `${token}.pdf`,
          href: inspectionPdfUrl(token, i18n.language),
          token,
        })}>
          <FileText className="w-4 h-4 mr-1.5" />{t("inspectionSign.download_pdf")}
        </Button>
        <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
      </div>,
    );
  }

  if (!view) return shell(null);

  const meta = view.meta ?? {};

  return shell(
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{view.template.heading}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t(`inspectionSign.phase_${view.phase}`)} · {view.report_ref}
        </p>
      </div>

      {/* Header summary */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-sm">
        {[
          [t("inspectionSign.unit"), [meta.unit_no, meta.unit_type].filter(Boolean).join(" · ")],
          [t("inspectionSign.tenant"), meta.tenant_name],
          [t("inspectionSign.move_in_date"), meta.move_in_date],
          [t("inspectionSign.move_out_date"), meta.move_out_date],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{value || "—"}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t("inspectionSign.intro")}</p>

      {/* Checklist */}
      <div className="space-y-2">
        {groups.map((group) => {
          const open = openGroups[group.key] ?? false;
          const disputed = group.items.filter((i) => i.response?.decision === "disputed").length;
          const answered = group.items.filter((i) => i.response).length;
          return (
            <div key={group.key} className="rounded-xl border bg-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))}
              >
                <span className="flex items-center gap-2">
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {group.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {disputed > 0 && <span className="text-red-600 mr-2">{t("inspectionSign.disputed_count", { count: disputed })}</span>}
                  {answered}/{group.items.length}
                </span>
              </button>

              {open && (
                <div className="divide-y border-t">
                  {group.items.map((item) => {
                    const style = item.status ? STATUS_ICON[item.status] : null;
                    const Icon = style?.icon;
                    const isDisputed = item.response?.decision === "disputed";
                    return (
                      <div key={item.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
                          </div>
                          {Icon && (
                            <span className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${style!.className}`}>
                              <Icon className="w-3 h-3" />{t(`inspectionSign.item_${item.status}`)}
                            </span>
                          )}
                        </div>

                        {item.photos.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {item.photos.map((p) => (
                              <a key={p.id} href={p.full} target="_blank" rel="noopener noreferrer">
                                <img src={p.url} alt="" className="h-16 w-16 rounded-md object-cover border" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Full-width taps on a phone; on a wider screen they
                            stop growing so the row stays scannable. */}
                        <div className="flex gap-2 sm:justify-start">
                          <Button
                            size="sm"
                            variant={item.response?.decision === "agreed" ? "default" : "outline"}
                            className="flex-1 sm:flex-none sm:min-w-32"
                            onClick={() => respond(item, "agreed")}
                          >
                            {t("inspectionSign.agree")}
                          </Button>
                          <Button
                            size="sm"
                            variant={isDisputed ? "destructive" : "outline"}
                            className="flex-1 sm:flex-none sm:min-w-32"
                            onClick={() => respond(item, "disputed")}
                          >
                            {t("inspectionSign.dispute")}
                          </Button>
                        </div>

                        {isDisputed && (
                          <Textarea
                            rows={2}
                            placeholder={t("inspectionSign.dispute_placeholder")}
                            value={comments[item.id] ?? item.response?.comment ?? ""}
                            onChange={(e) => setComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={() => respond(item, "disputed")}
                          />
                        )}

                        {/* Any row can carry the tenant's own photo, not only a
                            disputed one — evidence is worth more the earlier it
                            is taken. */}
                        {!view.signed && (
                          <Button
                            size="sm" variant="ghost"
                            className="-ml-2 text-muted-foreground"
                            onClick={() => { uploadTargetRef.current = item.id; fileInputRef.current?.click(); }}
                            disabled={uploading === item.id}
                          >
                            {uploading === item.id
                              ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              : <Camera className="w-3.5 h-3.5 mr-1" />}
                            {t("inspectionSign.add_photo")}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const itemId = uploadTargetRef.current;
          if (file && itemId) void upload(file, itemId);
          e.target.value = "";
        }}
      />

      {/* 특약사항 */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-2.5">{t("inspectionSign.special_terms")}</h2>
        <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground list-decimal pl-4">
          {view.template.specialTerms.map((term, i) => <li key={i}>{term}</li>)}
        </ol>
      </div>

      {/* Signature */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3.5">
        <h2 className="text-sm font-semibold">{t("inspectionSign.sign_title")}</h2>
        {unanswered > 0 && (
          <p className="text-xs text-amber-700">{t("inspectionSign.unanswered", { count: unanswered })}</p>
        )}
        <div>
          <label className="text-xs text-muted-foreground">{t("inspectionSign.signer_name")}</label>
          <Input className="mt-1" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
        </div>
        <SignaturePad value={signature} onChange={setSignature} label={t("inspectionSign.signature")} />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>{t("inspectionSign.consent")}</span>
        </label>
        {submitError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5"><X className="w-4 h-4" />{submitError}</p>
        )}
        <Button className="w-full h-11 text-base" onClick={submit} disabled={submitting || !signature || !consent}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("inspectionSign.submit")}
        </Button>
      </div>
    </div>,
  );
}
