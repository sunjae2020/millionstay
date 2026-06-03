import { useState, FormEvent } from "react";
import { Link } from "wouter";
import { useTranslation, Trans } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import logoSrc from "/millionstay-logo.png";

const BRAND = "#E8621A";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? t("forgot_password.error_generic"));
      } else {
        setSubmitted(true);
      }
    } catch {
      setError(t("forgot_password.error_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #1c1008 0%, #2e1a06 55%, #1c1008 100%)" }}
      >
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
        <div className="absolute -bottom-32 right-[-80px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, #FF9A50, transparent 70%)` }} />

        <div className="relative z-10">
          <img src={logoSrc} alt="MillionStay" className="h-9 w-auto" />
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">{t("forgot_password.admin_portal")}</p>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(232,98,26,0.2)", border: "1px solid rgba(232,98,26,0.3)" }}>
            <Mail className="h-7 w-7" style={{ color: BRAND }} />
          </div>
          <h2 className="text-[2rem] font-bold text-white leading-[1.2]">
            {t("forgot_password.brand_heading_line1")}<br />
            <span style={{ color: BRAND }}>{t("forgot_password.brand_heading_line2")}</span>
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-[260px]">
            {t("forgot_password.brand_subtitle")}
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs">{t("forgot_password.copyright")}</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center bg-[#faf9f7] px-6 py-12">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden flex justify-center mb-8">
            <img src={logoSrc} alt="MillionStay" className="h-8 w-auto" />
          </div>

          {submitted ? (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "#fff7f0", border: `2px solid ${BRAND}` }}>
                  <Mail className="h-7 w-7" style={{ color: BRAND }} />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{t("forgot_password.success_title")}</h1>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  <Trans
                    i18nKey="forgot_password.success_message"
                    values={{ email }}
                    components={{ 1: <strong /> }}
                  />
                </p>
              </div>
              <p className="text-xs text-slate-400">
                <Trans i18nKey="forgot_password.link_expiry" components={{ 1: <strong /> }} />
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-semibold text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
              >
                {t("forgot_password.back_to_sign_in")}
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900">{t("forgot_password.title")}</h1>
                <p className="text-slate-500 text-sm mt-1">
                  {t("forgot_password.subtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    {t("forgot_password.email_label")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t("forgot_password.email_placeholder")}
                    className="h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #FF8C3A 100%)` }}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("forgot_password.sending")}</>
                    : t("forgot_password.send_reset_link")
                  }
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                {t("forgot_password.remembered_prompt")}{" "}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: BRAND }}>
                  {t("forgot_password.back_to_sign_in")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
