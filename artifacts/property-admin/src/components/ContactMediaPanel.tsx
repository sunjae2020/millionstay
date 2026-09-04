import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { Loader2, Sparkles, Trash2, Upload, User, IdCard, ScanLine, ShieldCheck } from "lucide-react";
import { CameraButton } from "@/components/CameraButton";
import { OCR_MAX_EDGE } from "@/lib/photo";

/**
 * Profile photo + business-card panel for the contact form.
 *
 * Storage split (mirrors the API):
 *   • Profile photo — public Cloudinary asset; the URL lives on the contact row
 *     because the contact list renders it.
 *   • Business card — private ("authenticated") Cloudinary asset reachable only
 *     through short-lived signed URLs, indexed in the `documents` table.
 *
 * OCR never writes to the form on its own: the extracted fields are shown in an
 * approval dialog and only the ticked ones are applied.
 *
 * The panel can also read an identity document (passport / 주민등록증 / 운전면허증 /
 * 외국인등록증): the printed portrait is cropped out into the profile photo and the
 * general details are offered for approval. The ID image itself is never stored,
 * and document numbers (주민등록번호, 여권번호, 면허번호…) are never collected.
 */

export interface ScannedCardRef {
  public_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  preview_url: string;
}

export interface PendingCards {
  front?: ScannedCardRef;
  back?: ScannedCardRef;
}

interface ContactDocument {
  id: string;
  doc_type: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  signed_url: string | null;
}

/** Fields the OCR can return, in the order they are shown for approval. */
const OCR_FIELD_LABELS: Array<[string, string]> = [
  ["last_name", "contact.label_last_name"],
  ["first_name", "contact.label_first_name"],
  ["company_name", "contact.label_company"],
  ["department", "contact.label_department"],
  ["job_title", "contact.label_job_title"],
  ["email", "contact.label_email"],
  ["mobile_number", "contact.label_mobile"],
  ["office_number", "contact.label_office_phone"],
  ["website", "contact.label_website"],
  ["address_line1", "contact.label_address"],
  ["suburb", "contact.label_city"],
  ["state", "contact.label_state"],
  ["postcode", "contact.label_postcode"],
  ["country", "contact.label_country"],
  ["sns_id", "contact.label_sns_id"],
];

/** General fields an ID document can fill, in approval-dialog order. */
const ID_FIELD_LABELS: Array<[string, string]> = [
  ["last_name", "contact.label_last_name"],
  ["first_name", "contact.label_first_name"],
  ["date_of_birth", "contact.label_dob"],
  ["gender", "contact.label_gender"],
  ["nationality", "contact.label_nationality"],
  ["address_line1", "contact.label_address"],
  ["suburb", "contact.label_city"],
  ["state", "contact.label_state"],
  ["postcode", "contact.label_postcode"],
  ["country", "contact.label_country"],
];

const ID_DOC_KIND_LABELS: Record<string, string> = {
  passport: "contact.id_kind_passport",
  national_id: "contact.id_kind_national_id",
  driver_licence: "contact.id_kind_driver_licence",
  residence_card: "contact.id_kind_residence_card",
  other: "contact.id_kind_other",
};

interface Props {
  /** null while the contact is still unsaved (new form). */
  contactId: number | null;
  photoUrl: string;
  onPhotoChange: (url: string) => void;
  /** Reads the live form values, shown next to the extracted ones in the approval dialog. */
  getCurrentValues: () => Record<string, string>;
  onApplyFields: (fields: Record<string, string>) => void;
  /** Scanned-but-not-yet-attached cards; the parent attaches them after saving. */
  onPendingCardsChange: (cards: PendingCards) => void;
  /** Bumped by the parent after a save so the stored-document list refreshes. */
  refreshToken?: number;
}

export function ContactMediaPanel({
  contactId, photoUrl, onPhotoChange, getCurrentValues, onApplyFields, onPendingCardsChange, refreshToken,
}: Props) {
  const { t } = useTranslation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [extracted, setExtracted] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confidence, setConfidence] = useState<number | null>(null);
  /** Form values snapshotted when the dialog opened, for the before/after columns. */
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});
  const [ocrNotes, setOcrNotes] = useState<string | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const [idScanning, setIdScanning] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [idOpen, setIdOpen] = useState(false);
  const [idDocKind, setIdDocKind] = useState<string>("other");
  const [idPhoto, setIdPhoto] = useState<{ url: string; public_id: string } | null>(null);
  const [idFields, setIdFields] = useState<Record<string, string>>({});
  const [idSelected, setIdSelected] = useState<Record<string, boolean>>({});
  const [idBlocked, setIdBlocked] = useState<string[]>([]);
  const [idSnapshot, setIdSnapshot] = useState<Record<string, string>>({});
  const [idUsePhoto, setIdUsePhoto] = useState(true);

  const [documents, setDocuments] = useState<ContactDocument[]>([]);

  const loadDocuments = useCallback(async () => {
    if (!contactId) { setDocuments([]); return; }
    try {
      const res = await apiFetch(`/api/v1/contacts/${contactId}/documents`);
      const data = await res.json();
      if (data?.success) setDocuments(data.documents as ContactDocument[]);
    } catch {
      /* non-fatal — the panel still works for uploading */
    }
  }, [contactId]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments, refreshToken]);

  // Revoke object URLs so repeated re-picks don't leak.
  useEffect(() => () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
  }, [frontPreview, backPreview]);

  async function handlePhotoPick(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiFetch("/api/v1/contacts/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error ?? t("contact.photo_upload_failed"));
      onPhotoChange(data.url as string);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("contact.photo_upload_failed"));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function pickCard(side: "front" | "back", file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === "front") {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file); setFrontPreview(url);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file); setBackPreview(url);
    }
    setScanError(null);
  }

  async function handleScan() {
    if (!frontFile && !backFile) return;
    setScanning(true);
    setScanError(null);
    try {
      const form = new FormData();
      if (frontFile) form.append("front", frontFile);
      if (backFile) form.append("back", backFile);
      const res = await apiFetch("/api/v1/contacts/business-card/scan", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error ?? t("contact.card_scan_failed"));

      // The images are stored regardless of whether OCR succeeded — hand them to
      // the parent so they get attached to the contact on save.
      const pending: PendingCards = {};
      if (data.front) pending.front = data.front as ScannedCardRef;
      if (data.back) pending.back = data.back as ScannedCardRef;
      onPendingCardsChange(pending);

      const fields = (data.fields ?? {}) as Record<string, string>;
      setExtracted(fields);
      setConfidence(typeof data.confidence === "number" ? data.confidence : null);
      setOcrNotes(typeof data.notes === "string" ? data.notes : null);
      // Pre-tick every field that actually adds or changes something.
      const current = getCurrentValues();
      setSnapshot(current);
      const preselect: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(fields)) {
        preselect[key] = !!value && value !== (current[key] ?? "");
      }
      setSelected(preselect);

      if (data.ocr_error) setScanError(String(data.ocr_error));
      if (Object.keys(fields).length > 0) setReviewOpen(true);
      else if (!data.ocr_error) setScanError(t("contact.card_no_fields"));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : t("contact.card_scan_failed"));
    } finally {
      setScanning(false);
    }
  }

  function applySelected() {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (selected[key] && value) out[key] = value;
    }
    onApplyFields(out);
    setReviewOpen(false);
  }

  async function handleIdPick(file: File | undefined) {
    if (!file) return;
    setIdError(null);
    setIdScanning(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiFetch("/api/v1/contacts/id-document/scan", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error ?? t("contact.id_scan_failed"));

      const fields = (data.fields ?? {}) as Record<string, string>;
      const current = getCurrentValues();
      setIdSnapshot(current);
      setIdFields(fields);
      setIdDocKind(String(data.doc_kind ?? "other"));
      setIdPhoto((data.photo ?? null) as { url: string; public_id: string } | null);
      setIdBlocked(Array.isArray(data.blocked) ? (data.blocked as string[]) : []);
      setIdUsePhoto(!!data.photo);
      const preselect: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(fields)) {
        preselect[key] = !!value && value !== (current[key] ?? "");
      }
      setIdSelected(preselect);
      setIdOpen(true);
    } catch (err) {
      setIdError(err instanceof Error ? err.message : t("contact.id_scan_failed"));
    } finally {
      setIdScanning(false);
      if (idInputRef.current) idInputRef.current.value = "";
    }
  }

  function applyIdScan() {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(idFields)) {
      if (idSelected[key] && value) out[key] = value;
    }
    if (Object.keys(out).length) onApplyFields(out);
    if (idUsePhoto && idPhoto) onPhotoChange(idPhoto.url);
    setIdOpen(false);
    // Not accepted → the cropped avatar has no owner, so drop it from storage.
    if (!idUsePhoto && idPhoto) void discardIdPhoto(idPhoto.public_id);
    setIdPhoto(null);
  }

  function cancelIdScan() {
    setIdOpen(false);
    if (idPhoto) void discardIdPhoto(idPhoto.public_id);
    setIdPhoto(null);
  }

  async function discardIdPhoto(publicId: string) {
    try {
      await apiFetch("/api/v1/contacts/photo/discard", {
        method: "POST",
        body: JSON.stringify({ public_id: publicId }),
      });
    } catch {
      /* best effort — an orphaned crop is harmless, the ID itself was never stored */
    }
  }

  async function deleteDocument(docId: string) {
    if (!contactId) return;
    await apiFetch(`/api/v1/contacts/${contactId}/documents/${docId}`, { method: "DELETE" });
    void loadDocuments();
  }

  const storedFront = documents.find((d) => d.doc_type === "business_card_front");
  const storedBack = documents.find((d) => d.doc_type === "business_card_back");
  const rows = OCR_FIELD_LABELS.filter(([key]) => extracted[key]);
  const idRows = ID_FIELD_LABELS.filter(([key]) => idFields[key]);

  return (
    <>
      {/* Profile photo */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold text-sm">{t("contact.section_photo")}</h3>
        <div className="flex items-center gap-3">
          <div className="h-20 w-20 shrink-0 rounded-full border bg-muted/40 overflow-hidden flex items-center justify-center">
            {photoUrl
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : <User className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handlePhotoPick(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>
              {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("contact.photo_upload")}
            </Button>
            <input ref={idInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handleIdPick(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              disabled={idScanning} onClick={() => idInputRef.current?.click()}>
              {idScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
              {idScanning ? t("contact.id_scanning") : t("contact.id_scan")}
            </Button>
            {/* 신분증·증명사진은 그 자리에서 찍는 편이 빠르다. 판독을 태우는
                이미지라 축소 상한을 키워 글자를 남긴다. */}
            <CameraButton
              disabled={idScanning}
              maxEdge={OCR_MAX_EDGE}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
              onCapture={(files) => void handleIdPick(files[0])}
            />
            {photoUrl && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive"
                onClick={() => onPhotoChange("")}>
                <Trash2 className="h-3.5 w-3.5" /> {t("common.remove")}
              </Button>
            )}
          </div>
        </div>
        {photoError && <p className="text-xs text-destructive">{photoError}</p>}
        {idError && <p className="text-xs text-destructive">{idError}</p>}
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {t("contact.id_privacy_hint")}
        </p>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("contact.section_photo_url")}</Label>
          <Input value={photoUrl} placeholder="https://..." onChange={(e) => onPhotoChange(e.target.value)} />
        </div>
      </div>

      {/* Business card */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <IdCard className="h-4 w-4" /> {t("contact.section_business_card")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("contact.card_privacy_hint")}</p>

        <div className="grid grid-cols-2 gap-3">
          {([
            ["front", frontPreview, storedFront, frontInputRef, "contact.card_front"],
            ["back", backPreview, storedBack, backInputRef, "contact.card_back"],
          ] as const).map(([side, preview, stored, ref, labelKey]) => (
            <div key={side} className="space-y-1.5">
              <Label className="text-xs">{t(labelKey)}</Label>
              <button type="button" onClick={() => ref.current?.click()}
                className="w-full aspect-[16/10] rounded border border-dashed bg-muted/30 overflow-hidden flex items-center justify-center hover:bg-muted/50 transition-colors">
                {preview || stored?.signed_url
                  ? <img src={preview ?? stored?.signed_url ?? ""} alt="" className="h-full w-full object-contain" />
                  : <span className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3.5 w-3.5" />{t("contact.card_pick")}</span>}
              </button>
              <input ref={ref} type="file" accept="image/*" className="hidden"
                data-photo-max-edge={String(OCR_MAX_EDGE)}
                onChange={(e) => pickCard(side, e.target.files?.[0])} />
              {/* 명함은 받은 자리에서 찍는다 — OCR 이 읽을 해상도는 남긴다. */}
              <CameraButton
                maxEdge={OCR_MAX_EDGE}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                onCapture={(files) => pickCard(side, files[0])}
              />
              {stored && !preview && (
                <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-destructive"
                  onClick={() => void deleteDocument(stored.id)}>
                  <Trash2 className="h-3 w-3" /> {t("common.remove")}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button type="button" size="sm" className="w-full gap-1.5"
          disabled={scanning || (!frontFile && !backFile)} onClick={() => void handleScan()}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {scanning ? t("contact.card_scanning") : t("contact.card_scan")}
        </Button>
        {scanError && <p className="text-xs text-destructive">{scanError}</p>}
        {(frontFile || backFile) && !scanning && (
          <p className="text-xs text-muted-foreground">{t("contact.card_attach_hint")}</p>
        )}
      </div>

      {/* ID-document approval dialog — the crop and the general fields, opt-in per row. */}
      <Dialog open={idOpen} onOpenChange={(o) => { if (!o) cancelIdScan(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("contact.id_review_title")}</DialogTitle>
            <DialogDescription>
              {t("contact.id_review_desc")}
              {` · ${t(ID_DOC_KIND_LABELS[idDocKind] ?? "contact.id_kind_other")}`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto space-y-4">
            {/* Cropped portrait */}
            <div className="flex items-center gap-4 rounded-lg border p-3">
              <div className="h-24 w-24 shrink-0 rounded-full border bg-muted/40 overflow-hidden flex items-center justify-center">
                {idPhoto
                  ? <img src={idPhoto.url} alt="" className="h-full w-full object-cover" />
                  : <User className="h-8 w-8 text-muted-foreground" />}
              </div>
              <div className="space-y-1.5">
                {idPhoto ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={idUsePhoto} onCheckedChange={(c) => setIdUsePhoto(c === true)} />
                    {t("contact.id_use_photo")}
                  </label>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("contact.id_no_portrait")}</p>
                )}
                <p className="text-xs text-muted-foreground">{t("contact.id_photo_hint")}</p>
              </div>
            </div>

            {/* General fields */}
            {idRows.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-8 py-2" />
                    <th className="text-left py-2 font-medium">{t("contact.card_col_field")}</th>
                    <th className="text-left py-2 font-medium">{t("contact.card_col_current")}</th>
                    <th className="text-left py-2 font-medium">{t("contact.id_col_scanned")}</th>
                  </tr>
                </thead>
                <tbody>
                  {idRows.map(([key, labelKey]) => {
                    const current = idSnapshot[key] ?? "";
                    const value = idFields[key] ?? "";
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 align-top">
                          <Checkbox checked={!!idSelected[key]}
                            onCheckedChange={(c) => setIdSelected((v) => ({ ...v, [key]: c === true }))} />
                        </td>
                        <td className="py-2 align-top text-muted-foreground">{t(labelKey)}</td>
                        <td className="py-2 align-top text-muted-foreground">{current || "—"}</td>
                        <td className="py-2 align-top font-medium">
                          {value}
                          {current && current !== value && (
                            <span className="ml-1.5 text-xs text-orange-600">{t("contact.card_overwrites")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">{t("contact.id_no_fields")}</p>
            )}

            <p className="text-xs text-muted-foreground flex items-start gap-1 rounded-md bg-muted/40 p-2.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {t("contact.id_not_collected")}
                {idBlocked.length > 0 && ` (${t("contact.id_blocked_count", { count: idBlocked.length })})`}
              </span>
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={cancelIdScan}>{t("common.cancel")}</Button>
            <Button type="button" variant="outline"
              onClick={() => setIdSelected(Object.fromEntries(idRows.map(([k]) => [k, true])))}>
              {t("contact.card_select_all")}
            </Button>
            <Button type="button" onClick={applyIdScan}>{t("contact.card_apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR approval dialog — nothing is written until the admin confirms. */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("contact.card_review_title")}</DialogTitle>
            <DialogDescription>
              {t("contact.card_review_desc")}
              {confidence !== null && ` (${t("contact.card_confidence")}: ${Math.round(confidence * 100)}%)`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="w-8 py-2" />
                  <th className="text-left py-2 font-medium">{t("contact.card_col_field")}</th>
                  <th className="text-left py-2 font-medium">{t("contact.card_col_current")}</th>
                  <th className="text-left py-2 font-medium">{t("contact.card_col_scanned")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([key, labelKey]) => {
                  const current = snapshot[key] ?? "";
                  const value = extracted[key] ?? "";
                  return (
                    <tr key={key} className="border-b last:border-0">
                      <td className="py-2 align-top">
                        <Checkbox checked={!!selected[key]}
                          onCheckedChange={(c) => setSelected((s) => ({ ...s, [key]: c === true }))} />
                      </td>
                      <td className="py-2 align-top text-muted-foreground">{t(labelKey)}</td>
                      <td className="py-2 align-top text-muted-foreground">{current || "—"}</td>
                      <td className="py-2 align-top font-medium">
                        {value}
                        {current && current !== value && (
                          <span className="ml-1.5 text-xs text-orange-600">{t("contact.card_overwrites")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ocrNotes && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium">{t("contact.card_other_text")}:</span> {ocrNotes}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="outline"
              onClick={() => setSelected(Object.fromEntries(rows.map(([k]) => [k, true])))}>
              {t("contact.card_select_all")}
            </Button>
            <Button type="button" onClick={applySelected}>{t("contact.card_apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
