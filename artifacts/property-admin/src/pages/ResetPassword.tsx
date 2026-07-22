import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import logoSrc from "/millionstay-logo.png";
import { APP_NAME } from "@/lib/appName";

const BRAND = "hsl(var(--primary))";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [location] = useLocation();
  // Token arrives in the URL fragment (#token=...) so it's never sent to the
  // server in Referer headers; fall back to the query string for compatibility.
  const token = (() => {
    if (typeof window === "undefined") return "";
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    if (fromHash) return fromHash;
    return new URLSearchParams(window.location.search).get("token") ?? "";
  })();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("reset_password.error_passwords_mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("reset_password.error_min_length"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? t("reset_password.error_reset_failed"));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t("reset_password.error_generic"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
        <div className="w-full max-w-[400px] text-center space-y-5">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full flex items-center justify-center bg-red-50 border-2 border-red-200">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t("reset_password.invalid_link_title")}</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {t("reset_password.invalid_link_message")}
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-semibold text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, color-mix(in srgb, hsl(var(--primary)) 72%, white) 100%)` }}
          >
            {t("reset_password.request_new_link")}
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
        <div className="w-full max-w-[400px] text-center space-y-5">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "#fff7f0", border: `2px solid ${BRAND}` }}>
              <CheckCircle className="h-8 w-8" style={{ color: BRAND }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t("reset_password.success_title")}</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {t("reset_password.success_message")}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-lg text-sm font-semibold text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, color-mix(in srgb, hsl(var(--primary)) 72%, white) 100%)` }}
          >
            {t("reset_password.sign_in")} →
          </Link>
        </div>
      </div>
    );
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
          style={{ background: `radial-gradient(circle, color-mix(in srgb, hsl(var(--primary)) 72%, white), transparent 70%)` }} />

        <div className="relative z-10">
          {import.meta.env.VITE_LOGO_MODE === "text"
            ? <span className="font-display font-extrabold tracking-tight text-white text-xl whitespace-nowrap">{APP_NAME}</span>
            : <img src={logoSrc} alt={APP_NAME} className="h-9 w-auto" />}
          <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-2 ml-0.5">{t("reset_password.admin_portal")}</p>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-[2rem] font-bold text-white leading-[1.2]">
            {t("reset_password.brand_heading_line1")}<br />
            <span style={{ color: BRAND }}>{t("reset_password.brand_heading_line2")}</span>
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-[260px]">
            {t("reset_password.brand_subtitle")}
          </p>
          <ul className="space-y-2">
            {[
              t("reset_password.tip_min_length"),
              t("reset_password.tip_uppercase"),
              t("reset_password.tip_numbers_symbols"),
            ].map((tip) => (
              <li key={tip} className="flex items-center gap-2 text-white/50 text-sm">
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: BRAND }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs">{t("reset_password.copyright")}</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-[#faf9f7] px-6 py-12">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden flex justify-center mb-8">
            {import.meta.env.VITE_LOGO_MODE === "text"
              ? <span className="font-display font-extrabold tracking-tight text-primary text-xl whitespace-nowrap">{APP_NAME}</span>
              : <img src={logoSrc} alt={APP_NAME} className="h-8 w-auto" />}
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900">{t("reset_password.title")}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {t("reset_password.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">{t("reset_password.new_password_label")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t("reset_password.new_password_placeholder")}
                  className="h-11 bg-white border-slate-200 text-slate-900 pr-10 placeholder:text-slate-400"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= passwordStrength
                        ? passwordStrength <= 1 ? "bg-red-400"
                          : passwordStrength <= 2 ? "bg-amber-400"
                          : passwordStrength <= 3 ? "bg-blue-400"
                          : "bg-green-500"
                        : "bg-slate-200"
                    )} />
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1 whitespace-nowrap">
                    {["", t("reset_password.strength_weak"), t("reset_password.strength_fair"), t("reset_password.strength_good"), t("reset_password.strength_strong")][passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">{t("reset_password.confirm_password_label")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t("reset_password.confirm_password_placeholder")}
                  className={cn(
                    "h-11 bg-white border-slate-200 text-slate-900 pr-10 placeholder:text-slate-400",
                    confirmPassword && confirmPassword !== password && "border-red-300"
                  )}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md mt-2"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, color-mix(in srgb, hsl(var(--primary)) 72%, white) 100%)` }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("reset_password.updating")}</> : `${t("reset_password.update_password")} →`}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link href="/login" className="font-semibold hover:underline" style={{ color: BRAND }}>
              {t("reset_password.back_to_sign_in")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
