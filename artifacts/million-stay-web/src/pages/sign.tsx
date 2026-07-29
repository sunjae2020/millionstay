import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoute } from "wouter";
import { Loader2, CheckCircle2, AlertCircle, FileText, ArrowRight } from "lucide-react";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HsPageHero } from "@/components/homestay/sections";
import { HS, HS_FONT, HS_TINT } from "@/lib/homestay-theme";
import { ScrollToAgree } from "@/components/ScrollToAgree";
import SignaturePad from "@/components/SignaturePad";
import {
  getSigningRequest,
  submitSignatures,
  previewUrl,
  signedPdfUrl,
  SigningError,
  type SigningRequest,
} from "@/lib/signing-api";
import { APP_NAME } from "../lib/appName";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";

const CONTEXT_LABEL: Record<string, string> = {
  host_app: "Host Family Application",
  student_app: "Student Application",
  placement_contract: "Homestay Agreement",
  contract: "Accommodation Agreement",
};

const CONSENT_TEXT =
  "I confirm that I have read and understood the terms and conditions of this agreement, " +
  "that I am the person named as the signer, and I consent to signing this document electronically.";

/** A homestay-styled primary button. */
function HsButton({
  children, onClick, disabled, type = "button",
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: HS.brand, fontFamily: HS_FONT.body }}
    >
      {children}
    </button>
  );
}

export default function Sign() {
  const { t } = useTranslation();
  const [, params] = useRoute("/sign/:token");
  const token = params?.token ?? "";

  const [req, setReq] = useState<SigningRequest | null>(null);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawn signature data URLs keyed by signer role.
  const [sigs, setSigs] = useState<Record<string, string | null>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSigningRequest(token)
      .then((r) => { if (active) { setReq(r); setLoadError(null); } })
      .catch((e: unknown) => {
        if (!active) return;
        const err = e instanceof SigningError ? e : null;
        setLoadError({ code: err?.code ?? "error", message: err?.message ?? "Failed to load this signing link." });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const requiredMissing = useMemo(() => {
    if (!req) return true;
    return req.signers.some((s) => s.required && !sigs[s.role]);
  }, [req, sigs]);

  const contextLabel = req ? (CONTEXT_LABEL[req.context_type] ?? "Application") : "Application";
  const isHost = req?.context_type === "host_app";
  // Regular tenancy/accommodation contracts reuse this page but drop the
  // Homestay-specific wording.
  const isContract = req?.context_type === "contract";
  const docNoun = isContract ? "agreement" : "application";

  async function handleSubmit() {
    if (!req) return;
    setSubmitError(null);
    if (!consent) { setSubmitError("Please agree to the terms and conditions to sign."); return; }
    if (requiredMissing) { setSubmitError("Please provide all required signatures."); return; }

    const payload = req.signers
      .filter((s) => sigs[s.role])
      .map((s) => ({ role: s.role, name: s.name, signatureImage: sigs[s.role] as string }));

    setSubmitting(true);
    try {
      await submitSignatures(token, payload, consent);
      setDone(true);
    } catch (e) {
      const err = e instanceof SigningError ? e : null;
      setSubmitError(err?.message ?? "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";

  return (
    <HomestayLayout title={`${contextLabel} — Signature`}>
      <HsPageHero
        eyebrow={isContract ? APP_NAME : "Million Homestay"}
        title={`${contextLabel} — Signature`}
        lead={`Review your ${docNoun}, then sign below. Your electronic signature is legally binding.`}
      />

      <section className="px-6 pb-20">
        <div className="mx-auto w-full max-w-2xl">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: HS.brand }} />
            </div>
          )}

          {!loading && loadError && (
            <div className={`${card} p-8 text-center`}>
              <AlertCircle className="w-10 h-10 mx-auto text-gray-300" />
              <h2 className="mt-4 text-xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
                {loadError.code === "already_signed" ? "Already signed"
                  : loadError.code === "expired" ? "Link expired"
                  : loadError.code === "cancelled" ? "Request cancelled"
                  : "Unavailable"}
              </h2>
              <p className="mt-2 text-gray-600">{loadError.message}</p>
              {loadError.code === "already_signed" && (
                <div className="mt-6 inline-block">
                  <HsButton onClick={() => openPreview({ title: "Signed document", filename: `${token}.pdf`, href: signedPdfUrl(token) })}>
                    <FileText className="w-4 h-4" /> View signed PDF
                  </HsButton>
                </div>
              )}
            </div>
          )}

          {!loading && done && (
            <div className={`${card} p-8 text-center`}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: HS_TINT.brand }}>
                <CheckCircle2 className="w-9 h-9" style={{ color: HS.brand }} />
              </div>
              <h2 className="mt-5 text-2xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
                Thank you — your {docNoun} is signed
              </h2>
              <p className="mt-2 text-gray-600">
                Your signature has been recorded. A signed PDF copy has been emailed to you.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <HsButton onClick={() => openPreview({ title: "Signed document", filename: `${token}.pdf`, href: signedPdfUrl(token) })}>
                  <FileText className="w-4 h-4" /> View signed PDF
                </HsButton>
                <a
                  href={isHost ? "/host-portal" : "/"}
                  className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition"
                  style={{ borderColor: HS.mocha, color: HS.darkBrown, fontFamily: HS_FONT.body }}
                >
                  {isHost ? "Go to your host portal" : isContract ? `Back to ${APP_NAME}` : "Back to Million Homestay"}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {!loading && req && !done && (
            <div className={`${card} p-6 md:p-8`}>
              {/* Preview the full application before signing */}
              <button
                type="button"
                onClick={() => openPreview({
                  title: `Your ${contextLabel.toLowerCase()}`,
                  filename: `${token}.pdf`,
                  href: previewUrl(token),
                })}
                className="w-full flex items-center justify-between rounded-xl border px-4 py-3 transition hover:opacity-90"
                style={{ borderColor: HS.cream, backgroundColor: HS_TINT.cream }}
              >
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: HS.darkBrown }}>
                  <FileText className="w-4 h-4" style={{ color: HS.brand }} />
                  Preview your {contextLabel.toLowerCase()} (PDF)
                </span>
                <ArrowRight className="w-4 h-4" style={{ color: HS.brand }} />
              </button>

              <h2 className="mt-7 text-lg font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>
                Sign below
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {req.signers.length > 1
                  ? "Each named signer must draw their signature."
                  : "Draw your signature in the box below."}
              </p>

              <div className="mt-5 space-y-6">
                {req.signers.map((s) => (
                  <SignaturePad
                    key={s.role}
                    label={`${s.name}${s.required ? " *" : " (optional)"}`}
                    value={sigs[s.role] ?? null}
                    onChange={(v) => setSigs((prev) => ({ ...prev, [s.role]: v }))}
                  />
                ))}
              </div>

              <div className="mt-7">
                <ScrollToAgree
                  checked={consent}
                  onChange={setConsent}
                  accent={HS.brand}
                  maxHeightClass="max-h-40"
                  label={<span>{CONSENT_TEXT}</span>}
                >
                  <p className="m-0">{CONSENT_TEXT}</p>
                </ScrollToAgree>
              </div>

              {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}

              <div className="mt-7">
                <HsButton type="button" onClick={handleSubmit} disabled={submitting || !consent || requiredMissing}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isContract ? t("sign.title_agreement") : t("sign.title_application")}
                </HsButton>
              </div>
            </div>
          )}
        </div>
      </section>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </HomestayLayout>
  );
}
