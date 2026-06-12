import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignaturePad from "@/components/SignaturePad";
import {
  getSigningRequest,
  submitSignatures,
  SigningError,
  type SigningRequest,
} from "@/lib/signing-api";

const BRAND = "#E8621A";

const CONTEXT_LABEL: Record<string, string> = {
  host_app: "Host family application",
  student_app: "Student application",
  placement_contract: "Homestay agreement",
};

const CONSENT_TEXT =
  "I confirm that I have read and understood the terms and conditions of this agreement, " +
  "that I am the person named as the signer, and I consent to signing this document electronically.";

export default function Sign() {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <span className="font-bold text-gray-900">MillionStay</span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && loadError && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <AlertCircle className="w-10 h-10 mx-auto text-gray-300" />
              <h1 className="mt-4 text-xl font-bold text-gray-900">
                {loadError.code === "already_signed" ? "Already signed"
                  : loadError.code === "expired" ? "Link expired"
                  : loadError.code === "cancelled" ? "Request cancelled"
                  : "Unavailable"}
              </h1>
              <p className="mt-2 text-gray-600">{loadError.message}</p>
            </div>
          )}

          {!loading && done && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: BRAND }} />
              <h1 className="mt-4 text-xl font-bold text-gray-900">Thank you — signed</h1>
              <p className="mt-2 text-gray-600">Your signature has been recorded. You may close this page.</p>
            </div>
          )}

          {!loading && req && !done && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
              <h1 className="text-xl font-bold text-gray-900">
                {CONTEXT_LABEL[req.context_type] ?? "Document"} — signature
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Please review and sign below. Signing is legally binding.
              </p>

              <div className="mt-6 space-y-6">
                {req.signers.map((s) => (
                  <div key={s.role}>
                    <SignaturePad
                      label={`${s.name}${s.required ? " *" : " (optional)"}`}
                      value={sigs[s.role] ?? null}
                      onChange={(v) => setSigs((prev) => ({ ...prev, [s.role]: v }))}
                    />
                  </div>
                ))}
              </div>

              <label className="mt-6 flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{CONSENT_TEXT}</span>
              </label>

              {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !consent || requiredMissing}
                className="mt-6 w-full text-white"
                style={{ backgroundColor: BRAND }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign document"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
