import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { apiFetch, apiPost } from "@/lib/apiFetch";
import { ExportableTable } from "@/components/ui/ExportCsvButton";
import {
  Building2, Upload, Trash2, Sparkles, Loader2, UserRoundCheck, BadgeCheck, ShieldAlert, ShieldQuestion,
} from "lucide-react";

/**
 * Account identity — logo, "fill from the linked contact", website enrichment
 * and 사업자등록번호 verification.
 *
 * Both fill paths (contact + crawler) funnel through the SAME review dialog:
 * nothing is written straight onto the form. Overwriting an address an admin
 * typed by hand, just because they re-picked a contact, is exactly the failure
 * we are avoiding — so every field is a tick box showing current vs suggested,
 * and only fields that actually change something are pre-ticked.
 */

/** Account columns the panel may fill, with their form labels. */
const FIELD_LABELS: Array<[string, string]> = [
  ["name", "account.label_name"],
  ["account_email", "account.label_email"],
  ["website_url", "account.label_website"],
  ["phone1", "account.label_phone_1"],
  ["phone2", "account.label_phone_2"],
  ["address_line1", "account.label_address"],
  ["address_suburb", "account.label_city"],
  ["address_state", "account.label_state"],
  ["address_postcode", "account.label_postcode"],
  ["address_country", "account.label_country"],
  ["biz_registration_no", "account.label_biz_no"],
  ["ceo_name", "account.label_ceo"],
  ["description", "account.label_notes"],
];

export type FillSource = "contact" | "crawl";

export interface BizVerifyState {
  status: string | null;
  verified_at: string | null;
}

interface Props {
  /** Current form values for every column in FIELD_LABELS. */
  currentValues: Record<string, string>;
  /** Applies the approved subset back onto the form. */
  onApplyFields: (fields: Record<string, string>, source: FillSource) => void;
  logoUrl: string;
  onLogoChange: (url: string) => void;
  /** Linked primary contact, or null when none is picked yet. */
  primaryContactId: number | null;
  /** Website typed into the form — the crawl target. */
  websiteUrl: string;
  bizNo: string;
  bizVerify: BizVerifyState;
  onBizVerified: (state: BizVerifyState) => void;
  /** Provenance already recorded on the account, for the "auto-filled" hints. */
  fieldSources: Record<string, string>;
}

interface ReviewState {
  source: FillSource;
  fields: Record<string, string>;
  snapshot: Record<string, string>;
  selected: Record<string, boolean>;
  confidence: number | null;
  notes: string | null;
  sourceUrl: string | null;
  logoCandidates: string[];
  selectedLogo: string | null;
  bizChecksumOk: boolean | null;
}

const BIZ_STATUS_STYLES: Record<string, string> = {
  Valid: "bg-green-100 text-green-700 border-green-200",
  Suspended: "bg-amber-100 text-amber-800 border-amber-200",
  Closed: "bg-red-100 text-red-700 border-red-200",
  NotFound: "bg-gray-100 text-gray-600 border-gray-200",
};

export function AccountIdentityPanel({
  currentValues, onApplyFields, logoUrl, onLogoChange,
  primaryContactId, websiteUrl, bizNo, bizVerify, onBizVerified, fieldSources,
}: Props) {
  const { t } = useTranslation();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyDetail, setVerifyDetail] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);

  /** Builds the review state, pre-ticking only fields that change something. */
  function openReview(
    source: FillSource,
    fields: Record<string, string>,
    extras: Partial<Pick<ReviewState, "confidence" | "notes" | "sourceUrl" | "logoCandidates" | "bizChecksumOk">> = {},
  ) {
    const selected: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(fields)) {
      selected[key] = !!value && value !== (currentValues[key] ?? "");
    }
    setReview({
      source,
      fields,
      snapshot: { ...currentValues },
      selected,
      confidence: extras.confidence ?? null,
      notes: extras.notes ?? null,
      sourceUrl: extras.sourceUrl ?? null,
      logoCandidates: extras.logoCandidates ?? [],
      // Pre-select the first candidate only when the account has no logo yet.
      selectedLogo: !logoUrl ? (extras.logoCandidates?.[0] ?? null) : null,
      bizChecksumOk: extras.bizChecksumOk ?? null,
    });
  }

  // ── Fill from the linked primary contact ────────────────────────────────
  async function handleCopyFromContact() {
    if (!primaryContactId) return;
    setCopying(true);
    setCopyError(null);
    try {
      const res = await apiFetch(`/api/v1/contacts/${primaryContactId}`);
      const c = await res.json();
      if (!res.ok) throw new Error(c?.error ?? t("account.fill_contact_failed"));

      // office → phone1, mobile → phone2, so the switchboard stays the main line.
      const fields: Record<string, string> = {};
      const put = (key: string, value: unknown) => {
        if (typeof value === "string" && value.trim()) fields[key] = value.trim();
      };
      put("name", c.company_name);
      put("account_email", c.email);
      put("website_url", c.website);
      put("phone1", c.office_number || c.mobile_number);
      put("phone2", c.office_number ? c.mobile_number : "");
      put("address_line1", c.address_line1);
      put("address_suburb", c.suburb);
      put("address_state", c.state);
      put("address_postcode", c.postcode);
      put("address_country", c.country);

      if (!Object.keys(fields).length) {
        setCopyError(t("account.fill_contact_empty"));
        return;
      }
      openReview("contact", fields, {
        logoCandidates: typeof c.profile_photo_url === "string" && c.profile_photo_url ? [c.profile_photo_url] : [],
      });
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : t("account.fill_contact_failed"));
    } finally {
      setCopying(false);
    }
  }

  // ── Read the company website ────────────────────────────────────────────
  async function handleCrawl() {
    const url = websiteUrl.trim();
    if (!url) { setCrawlError(t("account.crawl_needs_url")); return; }
    setCrawling(true);
    setCrawlError(null);
    try {
      const res = await apiFetch("/api/v1/accounts/enrich-from-website", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error ?? t("account.crawl_failed"));

      const fields = (data.fields ?? {}) as Record<string, string>;
      if (!Object.keys(fields).length && !(data.logo_candidates ?? []).length) {
        setCrawlError(t("account.crawl_no_fields"));
        return;
      }
      openReview("crawl", fields, {
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        notes: typeof data.notes === "string" ? data.notes : null,
        sourceUrl: typeof data.source_url === "string" ? data.source_url : url,
        logoCandidates: Array.isArray(data.logo_candidates) ? data.logo_candidates : [],
        bizChecksumOk: data.biz_check ? !!data.biz_check.checksum_ok : null,
      });
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : t("account.crawl_failed"));
    } finally {
      setCrawling(false);
    }
  }

  /** Applies the ticked fields, re-hosting the chosen logo on our own CDN. */
  async function applyReview() {
    if (!review) return;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(review.fields)) {
      if (review.selected[key] && value) out[key] = value;
    }
    if (Object.keys(out).length) onApplyFields(out, review.source);

    if (review.selectedLogo) {
      setUploadingLogo(true);
      setLogoError(null);
      try {
        const data = await apiPost<{ url?: string }>("/api/v1/accounts/logo", { url: review.selectedLogo });
        if (data?.url) onLogoChange(data.url);
      } catch (err) {
        // The fields still applied — only the logo failed, so say exactly that.
        setLogoError(err instanceof Error ? err.message : t("account.logo_upload_failed"));
      } finally {
        setUploadingLogo(false);
      }
    }
    setReview(null);
  }

  // ── Manual logo upload ──────────────────────────────────────────────────
  async function handleLogoPick(file?: File) {
    if (!file) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiFetch("/api/v1/accounts/logo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error ?? t("account.logo_upload_failed"));
      onLogoChange(data.url);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t("account.logo_upload_failed"));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  // ── 사업자등록번호 verification ──────────────────────────────────────────
  async function handleVerifyBizNo() {
    const digits = bizNo.replace(/\D/g, "");
    if (digits.length !== 10) { setVerifyError(t("account.biz_no_needs_10")); return; }
    setVerifying(true);
    setVerifyError(null);
    setVerifyDetail(null);
    try {
      const data = await apiPost<{
        configured?: boolean; checksum_ok?: boolean; status?: string | null;
        status_text?: string | null; tax_type?: string | null; end_date?: string | null;
      }>("/api/v1/accounts/verify-biz-no", { biz_no: digits });

      if (!data?.configured) {
        // No NTS key: the checksum is the honest answer, and we say so.
        onBizVerified({ status: null, verified_at: null });
        setVerifyDetail(
          data?.checksum_ok ? t("account.biz_no_checksum_ok_only") : t("account.biz_no_checksum_bad"),
        );
        return;
      }
      onBizVerified({ status: data.status ?? null, verified_at: new Date().toISOString() });
      setVerifyDetail([data.status_text, data.tax_type, data.end_date].filter(Boolean).join(" · ") || null);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : t("account.biz_no_verify_failed"));
    } finally {
      setVerifying(false);
    }
  }

  const rows = FIELD_LABELS.filter(([key]) => review?.fields[key]);
  const bizStatusLabel = bizVerify.status ? t(`account.biz_status_${bizVerify.status.toLowerCase()}`) : null;

  return (
    <>
      {/* Logo / profile image */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold text-sm">{t("account.section_identity")}</h3>
        <div className="flex items-center gap-3">
          <div className="h-20 w-20 shrink-0 rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center">
            {logoUrl
              ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              : <Building2 className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handleLogoPick(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
              {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("account.logo_upload")}
            </Button>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive"
                onClick={() => onLogoChange("")}>
                <Trash2 className="h-3.5 w-3.5" /> {t("common.remove")}
              </Button>
            )}
          </div>
        </div>
        {logoError && <p className="text-xs text-destructive">{logoError}</p>}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("account.label_logo_url")}</Label>
          <Input value={logoUrl} placeholder="https://..." onChange={(e) => onLogoChange(e.target.value)} />
        </div>
      </div>

      {/* Auto-fill */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold text-sm">{t("account.section_autofill")}</h3>
        <p className="text-xs text-muted-foreground">{t("account.autofill_hint")}</p>

        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5"
          disabled={copying || !primaryContactId} onClick={() => void handleCopyFromContact()}>
          {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
          {t("account.fill_from_contact")}
        </Button>
        {!primaryContactId && <p className="text-xs text-muted-foreground">{t("account.fill_needs_contact")}</p>}
        {copyError && <p className="text-xs text-destructive">{copyError}</p>}

        <Button type="button" size="sm" className="w-full gap-1.5"
          disabled={crawling || !websiteUrl.trim()} onClick={() => void handleCrawl()}>
          {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {crawling ? t("account.crawl_running") : t("account.fill_from_website")}
        </Button>
        {!websiteUrl.trim() && <p className="text-xs text-muted-foreground">{t("account.crawl_needs_url")}</p>}
        {crawlError && <p className="text-xs text-destructive">{crawlError}</p>}
      </div>

      {/* Company registration */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold text-sm">{t("account.section_registration")}</h3>
        <div className="flex items-end gap-2">
          <div className="grid gap-1.5 flex-1">
            <Label className="text-xs text-muted-foreground">{t("account.label_biz_no")}</Label>
            <Input value={bizNo} readOnly tabIndex={-1} className="bg-muted/40" placeholder="000-00-00000" />
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5"
            disabled={verifying || bizNo.replace(/\D/g, "").length !== 10}
            onClick={() => void handleVerifyBizNo()}>
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
            {t("account.biz_no_verify")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("account.biz_no_edit_hint")}</p>
        {bizStatusLabel && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${BIZ_STATUS_STYLES[bizVerify.status ?? ""] ?? ""}`}>
              {bizVerify.status === "Valid" ? <BadgeCheck className="h-3 w-3 mr-1" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
              {bizStatusLabel}
            </Badge>
            {bizVerify.verified_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(bizVerify.verified_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        {verifyDetail && <p className="text-xs text-muted-foreground">{verifyDetail}</p>}
        {verifyError && (
          <p className="text-xs text-destructive flex items-start gap-1">
            <ShieldQuestion className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {verifyError}
          </p>
        )}
        {Object.keys(fieldSources).length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("account.autofilled_count", { count: Object.keys(fieldSources).length })}
          </p>
        )}
      </div>

      {/* Review dialog — nothing is written until the admin confirms. */}
      <Dialog open={!!review} onOpenChange={(open) => { if (!open) setReview(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {review?.source === "crawl" ? t("account.review_crawl_title") : t("account.review_contact_title")}
            </DialogTitle>
            <DialogDescription>
              {review?.source === "crawl" ? t("account.review_crawl_desc") : t("account.review_contact_desc")}
              {review?.confidence != null && ` (${t("account.review_confidence")}: ${Math.round(review.confidence * 100)}%)`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto space-y-4">
            {review?.sourceUrl && (
              <p className="text-xs text-muted-foreground break-all">{review.sourceUrl}</p>
            )}

            {rows.length > 0 && (
              <ExportableTable fileName="account-identity-panel" className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-8 py-2" />
                    <th className="text-left py-2 font-medium">{t("account.review_col_field")}</th>
                    <th className="text-left py-2 font-medium">{t("account.review_col_current")}</th>
                    <th className="text-left py-2 font-medium">{t("account.review_col_suggested")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, labelKey]) => {
                    const current = review?.snapshot[key] ?? "";
                    const value = review?.fields[key] ?? "";
                    const bizWarning = key === "biz_registration_no" && review?.bizChecksumOk === false;
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 align-top">
                          <Checkbox checked={!!review?.selected[key]}
                            onCheckedChange={(c) =>
                              setReview((s) => (s ? { ...s, selected: { ...s.selected, [key]: c === true } } : s))} />
                        </td>
                        <td className="py-2 align-top text-muted-foreground">{t(labelKey)}</td>
                        <td className="py-2 align-top text-muted-foreground break-words">{current || "—"}</td>
                        <td className="py-2 align-top break-words">
                          {value}
                          {bizWarning && (
                            <span className="block text-xs text-destructive">{t("account.biz_no_checksum_bad")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ExportableTable>
            )}

            {!!review?.logoCandidates.length && (
              <div className="space-y-2">
                <p className="text-xs font-medium">{t("account.review_logo")}</p>
                <div className="flex flex-wrap gap-2">
                  {review.logoCandidates.map((url) => {
                    const picked = review.selectedLogo === url;
                    return (
                      <button key={url} type="button"
                        onClick={() => setReview((s) => (s ? { ...s, selectedLogo: picked ? null : url } : s))}
                        className={`h-16 w-16 rounded border overflow-hidden bg-muted/30 flex items-center justify-center transition-colors ${
                          picked ? "ring-2 ring-primary border-primary" : "hover:bg-muted/60"
                        }`}>
                        <img src={url} alt="" className="h-full w-full object-contain" />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{t("account.review_logo_hint")}</p>
              </div>
            )}

            {review?.notes && (
              <div className="rounded border bg-muted/30 p-3">
                <p className="text-xs font-medium mb-1">{t("account.review_notes")}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{review.notes}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReview(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={() => void applyReview()}>
              {t("account.review_apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AccountIdentityPanel;
